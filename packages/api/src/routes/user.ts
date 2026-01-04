import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest, setTokenCookie, generateToken, type JwtPayload } from "../middleware/auth.js";
import { getUserById, updateWalletAddress, isValidEthereumAddress } from "../services/user.js";

const router = Router();

/**
 * GET /user/profile
 * Get current user's full profile
 */
router.get("/profile", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await getUserById(req.user.userId);

  if (!user) {
    res.status(404).json({
      error: "User not found",
      message: "User account no longer exists",
    });
    return;
  }

  res.json({
    user: {
      id: user.id,
      arenaUserId: user.arenaUserId,
      arenaUsername: user.arenaUsername,
      arenaSlug: user.arenaSlug,
      walletAddress: user.walletAddress,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
});

/**
 * PUT /user/wallet
 * Update user's wallet address
 */
router.put("/wallet", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { walletAddress } = req.body;

  // Validate wallet address
  if (!walletAddress || typeof walletAddress !== "string") {
    res.status(400).json({
      error: "Invalid request",
      message: "Wallet address is required",
    });
    return;
  }

  if (!isValidEthereumAddress(walletAddress)) {
    res.status(400).json({
      error: "Invalid wallet address",
      message: "Must be a valid Ethereum address (0x followed by 40 hex characters)",
    });
    return;
  }

  const updatedUser = await updateWalletAddress(req.user.userId, walletAddress);

  if (!updatedUser) {
    res.status(404).json({
      error: "User not found",
      message: "User account no longer exists",
    });
    return;
  }

  // Generate a new token with the updated wallet address
  const newPayload: JwtPayload = {
    userId: updatedUser.id,
    arenaUserId: updatedUser.arenaUserId,
    arenaUsername: updatedUser.arenaUsername,
    walletAddress: updatedUser.walletAddress,
  };

  const newToken = generateToken(newPayload);
  setTokenCookie(res, newToken);

  res.json({
    success: true,
    user: {
      id: updatedUser.id,
      arenaUserId: updatedUser.arenaUserId,
      arenaUsername: updatedUser.arenaUsername,
      arenaSlug: updatedUser.arenaSlug,
      walletAddress: updatedUser.walletAddress,
    },
  });
});

/**
 * DELETE /user/wallet
 * Remove user's wallet address
 */
router.delete("/wallet", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const updatedUser = await updateWalletAddress(req.user.userId, "");

  if (!updatedUser) {
    res.status(404).json({
      error: "User not found",
      message: "User account no longer exists",
    });
    return;
  }

  // Generate a new token with null wallet address
  const newPayload: JwtPayload = {
    userId: updatedUser.id,
    arenaUserId: updatedUser.arenaUserId,
    arenaUsername: updatedUser.arenaUsername,
    walletAddress: null,
  };

  const newToken = generateToken(newPayload);
  setTokenCookie(res, newToken);

  res.json({
    success: true,
    message: "Wallet address removed",
  });
});

export default router;
