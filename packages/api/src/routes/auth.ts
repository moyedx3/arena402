import { Router, Request, Response } from "express";
import { env, isDevelopment } from "../config.js";
import { ArenaClient } from "../services/arena.js";
import { findOrCreateUser } from "../services/user.js";
import {
  generateToken,
  setTokenCookie,
  clearTokenCookie,
  requireAuth,
  type AuthenticatedRequest,
  type JwtPayload,
} from "../middleware/auth.js";

const router = Router();

const ARENA_AUTH_URL = "https://dev.are.na/oauth/authorize";
const ARENA_TOKEN_URL = "https://dev.are.na/oauth/token";

/**
 * GET /auth/arena
 * Redirect to Are.na OAuth authorization page
 */
router.get("/arena", (req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: env.arenaClientId,
    redirect_uri: env.arenaRedirectUri,
    response_type: "code",
  });

  const authUrl = `${ARENA_AUTH_URL}?${params.toString()}`;

  if (isDevelopment) {
    console.log("Redirecting to Are.na OAuth:", authUrl);
  }

  res.redirect(authUrl);
});

/**
 * GET /auth/arena/callback
 * Handle OAuth callback from Are.na
 */
router.get("/arena/callback", async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error) {
    console.error("OAuth error from Are.na:", error);
    res.status(400).json({
      error: "OAuth error",
      message: String(error),
    });
    return;
  }

  if (!code || typeof code !== "string") {
    res.status(400).json({
      error: "Missing code",
      message: "Authorization code not provided",
    });
    return;
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(ARENA_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.arenaClientId,
        client_secret: env.arenaClientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: env.arenaRedirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", tokenResponse.status, errorText);
      res.status(400).json({
        error: "Token exchange failed",
        message: "Failed to exchange authorization code for access token",
      });
      return;
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      token_type: string;
    };

    if (isDevelopment) {
      console.log("Token exchange successful");
    }

    // Fetch user profile from Are.na
    const arenaClient = new ArenaClient(tokenData.access_token);
    const arenaUser = await arenaClient.getMe();

    if (isDevelopment) {
      console.log("Fetched Are.na user:", arenaUser.username);
    }

    // Find or create user in our database
    const user = await findOrCreateUser(arenaUser, tokenData.access_token);

    // Generate JWT
    const jwtPayload: JwtPayload = {
      userId: user.id,
      arenaUserId: user.arenaUserId,
      arenaUsername: user.arenaUsername,
      walletAddress: user.walletAddress,
    };

    const token = generateToken(jwtPayload);

    // Set httpOnly cookie
    setTokenCookie(res, token);

    // Return user info (frontend can redirect based on this)
    res.json({
      success: true,
      user: {
        id: user.id,
        arenaUserId: user.arenaUserId,
        arenaUsername: user.arenaUsername,
        arenaSlug: user.arenaSlug,
        walletAddress: user.walletAddress,
      },
    });
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).json({
      error: "Authentication failed",
      message: isDevelopment ? String(err) : "An error occurred during authentication",
    });
  }
});

/**
 * GET /auth/me
 * Get current authenticated user
 */
router.get("/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: req.user,
  });
});

/**
 * POST /auth/logout
 * Clear session and log out
 */
router.post("/logout", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  clearTokenCookie(res);
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

export default router;
