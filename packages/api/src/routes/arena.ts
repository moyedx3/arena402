import { Router, Request, Response, NextFunction } from "express";
import { arenaClient, ArenaApiError } from "../services/arena.js";

const router = Router();

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
// Proxy to Are.na, returns channel info
router.get("/channels/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const channel = await arenaClient.getChannel(slug);

    // TODO (Phase 3): Add paywall metadata to blocks
    // For now, just passthrough the response

    return res.json(channel);
  } catch (error) {
    return handleArenaError(error, res);
  }
});

// GET /v2/channels/:slug/contents
// Proxy to Are.na, returns channel contents with pagination
router.get("/channels/:slug/contents", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const per = req.query.per ? parseInt(req.query.per as string, 10) : undefined;

    const contents = await arenaClient.getChannelContents(slug, { page, per });

    // TODO (Phase 3): Add paywall metadata to blocks
    // For now, just passthrough the response

    return res.json(contents);
  } catch (error) {
    return handleArenaError(error, res);
  }
});

// GET /v2/blocks/:id
// Proxy to Are.na, returns block content
// TODO (Phase 3): Check paywall status and return 402 if unpaid
router.get("/blocks/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        error: "Invalid block ID",
        message: "Block ID must be a number",
      });
    }

    const block = await arenaClient.getBlock(id);

    // TODO (Phase 3): Check if block is paywalled
    // TODO (Phase 4): Return 402 with x402 headers if unpaid

    return res.json(block);
  } catch (error) {
    return handleArenaError(error, res);
  }
});

export default router;
