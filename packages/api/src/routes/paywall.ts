import { Router, Request, Response, type Router as RouterType } from "express";
import { requireAuth, optionalAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import {
  createPaywall,
  getPaywallByBlockId,
  getPaywallsByOwner,
  updatePaywall,
  deletePaywall,
  verifyBlockOwnership,
  PaywallError,
} from "../services/paywall.js";
import { getUserById } from "../services/user.js";

const router: RouterType = Router();

/**
 * POST /paywall/configure
 * Create or update a paywall on a block
 */
router.post("/configure", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { blockId, priceUsdc, recipientWallet } = req.body;

    // Validate required fields
    if (!blockId || typeof blockId !== "number") {
      return res.status(400).json({
        error: "Invalid request",
        message: "blockId is required and must be a number",
      });
    }

    if (!priceUsdc || typeof priceUsdc !== "string") {
      return res.status(400).json({
        error: "Invalid request",
        message: "priceUsdc is required and must be a string (e.g., '0.05')",
      });
    }

    // Get user's Are.na access token for ownership verification
    const user = await getUserById(req.user!.userId);
    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not found",
      });
    }

    // Verify user owns the block on Are.na
    const ownsBlock = await verifyBlockOwnership(
      user.arenaUserId,
      blockId,
      user.arenaAccessToken ?? undefined
    );

    if (!ownsBlock) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You do not own this block on Are.na",
      });
    }

    // Check if paywall already exists
    const existing = await getPaywallByBlockId(blockId);
    if (existing) {
      // Update existing paywall
      const updated = await updatePaywall(blockId, req.user!.userId, {
        priceUsdc,
        recipientWallet,
      });

      return res.json({
        message: "Paywall updated",
        paywall: {
          id: updated!.id,
          blockId: updated!.blockId,
          priceUsdc: updated!.priceUsdc,
          recipientWallet: updated!.recipientWallet,
          active: updated!.active,
          createdAt: updated!.createdAt,
          updatedAt: updated!.updatedAt,
        },
      });
    }

    // Create new paywall
    const paywall = await createPaywall({
      blockId,
      ownerUserId: req.user!.userId,
      priceUsdc,
      recipientWallet,
    });

    return res.status(201).json({
      message: "Paywall created",
      paywall: {
        id: paywall.id,
        blockId: paywall.blockId,
        priceUsdc: paywall.priceUsdc,
        recipientWallet: paywall.recipientWallet,
        active: paywall.active,
        createdAt: paywall.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof PaywallError) {
      const statusCode =
        error.code === "FORBIDDEN" || error.code === "NOT_OWNER"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : 400;

      return res.status(statusCode).json({
        error: error.code,
        message: error.message,
      });
    }

    console.error("Error configuring paywall:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /paywall/:blockId
 * Get paywall configuration for a block (public endpoint)
 */
router.get("/:blockId", async (req: Request, res: Response) => {
  try {
    const blockId = parseInt(req.params.blockId, 10);

    if (isNaN(blockId)) {
      return res.status(400).json({
        error: "Invalid request",
        message: "blockId must be a number",
      });
    }

    const paywall = await getPaywallByBlockId(blockId);

    if (!paywall) {
      return res.status(404).json({
        error: "Not found",
        message: "No paywall exists for this block",
      });
    }

    return res.json({
      blockId: paywall.blockId,
      priceUsdc: paywall.priceUsdc,
      currency: "USDC",
      network: "base",
      recipientWallet: paywall.recipientWallet,
      ownerUsername: paywall.ownerUsername,
      ownerSlug: paywall.ownerSlug,
      active: paywall.active,
      createdAt: paywall.createdAt,
    });
  } catch (error) {
    console.error("Error getting paywall:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * DELETE /paywall/:blockId
 * Remove paywall from a block (owner only)
 */
router.delete("/:blockId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const blockId = parseInt(req.params.blockId, 10);

    if (isNaN(blockId)) {
      return res.status(400).json({
        error: "Invalid request",
        message: "blockId must be a number",
      });
    }

    await deletePaywall(blockId, req.user!.userId);

    return res.status(204).send();
  } catch (error) {
    if (error instanceof PaywallError) {
      const statusCode =
        error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 400;

      return res.status(statusCode).json({
        error: error.code,
        message: error.message,
      });
    }

    console.error("Error deleting paywall:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /paywall/my-paywalls
 * Get all paywalls owned by current user
 */
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paywalls = await getPaywallsByOwner(req.user!.userId);

    return res.json({
      paywalls: paywalls.map((p) => ({
        id: p.id,
        blockId: p.blockId,
        priceUsdc: p.priceUsdc,
        recipientWallet: p.recipientWallet,
        active: p.active,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error getting user paywalls:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
