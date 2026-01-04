import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config.js";
import { getUserById } from "../services/user.js";

export interface JwtPayload {
  userId: string;
  arenaUserId: number;
  arenaUsername: string | null;
  walletAddress: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

const JWT_COOKIE_NAME = "arena402_token";
const JWT_EXPIRES_IN = "7d";

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Set JWT token as httpOnly cookie
 */
export function setTokenCookie(res: Response, token: string): void {
  res.cookie(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });
}

/**
 * Clear the JWT cookie
 */
export function clearTokenCookie(res: Response): void {
  res.clearCookie(JWT_COOKIE_NAME, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
  });
}

/**
 * Get token from request (cookie or Authorization header)
 */
function getTokenFromRequest(req: Request): string | null {
  // Check cookie first
  const cookieToken = req.cookies?.[JWT_COOKIE_NAME];
  if (cookieToken) {
    return cookieToken;
  }

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * Middleware that requires authentication
 * Returns 401 if user is not authenticated
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = getTokenFromRequest(req);

  if (!token) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required",
    });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
    return;
  }

  req.user = payload;
  next();
}

/**
 * Middleware that optionally extracts user if authenticated
 * Does not return error if not authenticated
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = getTokenFromRequest(req);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}

/**
 * Refresh token with latest user data from database
 */
export async function refreshUserToken(userId: string): Promise<string | null> {
  const user = await getUserById(userId);
  if (!user) {
    return null;
  }

  const payload: JwtPayload = {
    userId: user.id,
    arenaUserId: user.arenaUserId,
    arenaUsername: user.arenaUsername,
    walletAddress: user.walletAddress,
  };

  return generateToken(payload);
}
