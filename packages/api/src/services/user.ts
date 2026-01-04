import { eq } from "drizzle-orm";
import { db, users, type User, type NewUser } from "../db/index.js";

export interface ArenaOAuthUser {
  id: number;
  slug: string;
  username: string;
  first_name: string;
  last_name: string;
}

/**
 * Find or create a user from Are.na OAuth response
 */
export async function findOrCreateUser(
  arenaUser: ArenaOAuthUser,
  accessToken: string
): Promise<User> {
  // Try to find existing user
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.arenaUserId, arenaUser.id))
    .limit(1);

  if (existing.length > 0) {
    // Update existing user with new token and info
    const [updated] = await db
      .update(users)
      .set({
        arenaUsername: arenaUser.username,
        arenaSlug: arenaUser.slug,
        arenaAccessToken: accessToken,
        updatedAt: new Date(),
      })
      .where(eq(users.arenaUserId, arenaUser.id))
      .returning();

    return updated;
  }

  // Create new user
  const newUser: NewUser = {
    arenaUserId: arenaUser.id,
    arenaUsername: arenaUser.username,
    arenaSlug: arenaUser.slug,
    arenaAccessToken: accessToken,
  };

  const [created] = await db.insert(users).values(newUser).returning();
  return created;
}

/**
 * Get user by UUID
 */
export async function getUserById(id: string): Promise<User | null> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get user by Are.na user ID
 */
export async function getUserByArenaId(arenaUserId: number): Promise<User | null> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.arenaUserId, arenaUserId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Update user's wallet address
 */
export async function updateWalletAddress(
  userId: string,
  walletAddress: string
): Promise<User | null> {
  const [updated] = await db
    .update(users)
    .set({
      walletAddress,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return updated ?? null;
}

/**
 * Validate Ethereum wallet address format
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
