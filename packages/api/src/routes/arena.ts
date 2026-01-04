import { Router, Request, Response } from "express";
import { arenaClient, ArenaApiError, type ArenaBlock } from "../services/arena.js";
import { getPaywallsForBlocks, getPaywallByBlockId } from "../services/paywall.js";
import { getBlockAccessStatus } from "../services/accessGrant.js";
import { optionalAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// Apply optional auth to all routes to extract wallet from JWT if available
router.use(optionalAuth);

// Helper to extract wallet address from request
function getWalletFromRequest(req: AuthenticatedRequest): string | undefined {
  // Check X-Wallet-Address header (for API clients)
  const headerWallet = req.headers["x-wallet-address"] as string | undefined;
  if (headerWallet) return headerWallet.toLowerCase();

  // Check query param (fallback)
  const queryWallet = req.query.wallet as string | undefined;
  if (queryWallet) return queryWallet.toLowerCase();

  // Check JWT for logged-in users (wallet stored in token)
  if (req.user?.walletAddress) {
    return req.user.walletAddress.toLowerCase();
  }

  return undefined;
}

// Helper to inject paywall metadata into blocks
interface BlockWithPaywall extends ArenaBlock {
  _paywall?: {
    active: boolean;
    priceUsdc: string;
    currency: string;
  } | null;
}

async function injectPaywallMetadata(
  blocks: ArenaBlock[]
): Promise<BlockWithPaywall[]> {
  if (blocks.length === 0) return [];

  const blockIds = blocks.map((b) => b.id);
  const paywallMap = await getPaywallsForBlocks(blockIds);

  return blocks.map((block) => {
    const paywall = paywallMap.get(block.id);
    return {
      ...block,
      _paywall: paywall
        ? {
            active: paywall.active,
            priceUsdc: paywall.priceUsdc,
            currency: "USDC",
          }
        : null,
    };
  });
}

// Error handler for Arena API errors
function handleArenaError(error: unknown, res: Response) {
  if (error instanceof ArenaApiError) {
    return res.status(error.statusCode).json({
      error: "Are.na API error",
      message: error.message,
      details: error.responseBody,
    });
  }

  console.error("Unexpected error:", error);
  return res.status(500).json({
    error: "Internal server error",
    message: error instanceof Error ? error.message : "Unknown error",
  });
}

// GET /v2/channels/:slug
// Proxy to Are.na, returns channel info with paywall metadata
router.get("/channels/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const channel = await arenaClient.getChannel(slug);

    // Inject paywall metadata into contents if present
    if (channel.contents && Array.isArray(channel.contents)) {
      const blocksWithPaywall = await injectPaywallMetadata(channel.contents);
      return res.json({
        ...channel,
        contents: blocksWithPaywall,
      });
    }

    return res.json(channel);
  } catch (error) {
    return handleArenaError(error, res);
  }
});

// GET /v2/channels/:slug/contents
// Proxy to Are.na, returns channel contents with paywall metadata
router.get("/channels/:slug/contents", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const per = req.query.per ? parseInt(req.query.per as string, 10) : undefined;

    const contents = await arenaClient.getChannelContents(slug, { page, per });

    // Inject paywall metadata into blocks
    if (contents.contents && Array.isArray(contents.contents)) {
      const blocksWithPaywall = await injectPaywallMetadata(contents.contents);
      return res.json({
        ...contents,
        contents: blocksWithPaywall,
      });
    }

    return res.json(contents);
  } catch (error) {
    return handleArenaError(error, res);
  }
});

// GET /v2/blocks/:id
// Proxy to Are.na, checks paywall status and access
router.get("/blocks/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        error: "Invalid block ID",
        message: "Block ID must be a number",
      });
    }

    // Get wallet address from request
    const walletAddress = getWalletFromRequest(req);

    // Check paywall and access status
    const accessStatus = await getBlockAccessStatus(id, walletAddress);

    // If paywalled and no access, return 402 (or 403 for now, until x402 is integrated)
    if (accessStatus.isPaywalled && !accessStatus.hasAccess) {
      // Get full paywall info for response
      const paywall = await getPaywallByBlockId(id);

      // In Milestone 4, this will be a proper 402 with x402 headers
      // For now, return 402 with paywall info
      return res.status(402).json({
        error: "Payment required",
        message: "This block requires payment to access",
        paywall: {
          blockId: id,
          priceUsdc: accessStatus.priceUsdc,
          currency: "USDC",
          network: "base",
          recipientWallet: accessStatus.recipientWallet,
          ownerUsername: paywall?.ownerUsername,
        },
      });
    }

    // Fetch and return block content
    const block = await arenaClient.getBlock(id);

    // Add paywall metadata even to accessible blocks
    const paywall = await getPaywallByBlockId(id);
    const blockWithPaywall: BlockWithPaywall = {
      ...block,
      _paywall: paywall
        ? {
            active: paywall.active,
            priceUsdc: paywall.priceUsdc,
            currency: "USDC",
          }
        : null,
    };

    return res.json(blockWithPaywall);
  } catch (error) {
    return handleArenaError(error, res);
  }
});

export default router;
