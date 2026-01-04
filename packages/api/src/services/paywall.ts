import { eq, and } from "drizzle-orm";
import { db, paywalls, users, type Paywall, type NewPaywall } from "../db/index.js";
import { isValidEthereumAddress } from "./user.js";
import { ArenaClient, type ArenaBlock } from "./arena.js";

// Minimum price in USDC
const MIN_PRICE_USDC = "0.01";

export interface CreatePaywallParams {
  blockId: number;
  ownerUserId: string;
  priceUsdc: string;
  recipientWallet?: string; // Optional, uses user's wallet if not provided
}

export interface UpdatePaywallParams {
  priceUsdc?: string;
  recipientWallet?: string;
  active?: boolean;
}

export interface PaywallWithOwner extends Paywall {
  ownerUsername?: string | null;
  ownerSlug?: string | null;
}

/**
 * Create a new paywall for a block
 */
export async function createPaywall(params: CreatePaywallParams): Promise<Paywall> {
  const { blockId, ownerUserId, priceUsdc, recipientWallet } = params;

  // Validate price
  if (parseFloat(priceUsdc) < parseFloat(MIN_PRICE_USDC)) {
    throw new PaywallError(`Minimum price is ${MIN_PRICE_USDC} USDC`, "INVALID_PRICE");
  }

  // Get user's wallet if recipientWallet not provided
  let finalRecipientWallet = recipientWallet;
  if (!finalRecipientWallet) {
    const [user] = await db
      .select({ walletAddress: users.walletAddress })
      .from(users)
      .where(eq(users.id, ownerUserId))
      .limit(1);

    if (!user?.walletAddress) {
      throw new PaywallError(
        "No wallet address configured. Please set your wallet address first.",
        "NO_WALLET"
      );
    }
    finalRecipientWallet = user.walletAddress;
  }

  // Validate wallet address
  if (!isValidEthereumAddress(finalRecipientWallet)) {
    throw new PaywallError("Invalid recipient wallet address", "INVALID_WALLET");
  }

  // Check if paywall already exists for this block
  const existing = await getPaywallByBlockId(blockId);
  if (existing) {
    throw new PaywallError("Paywall already exists for this block", "ALREADY_EXISTS");
  }

  const newPaywall: NewPaywall = {
    blockId,
    ownerUserId,
    priceUsdc,
    recipientWallet: finalRecipientWallet,
    active: true,
  };

  const [created] = await db.insert(paywalls).values(newPaywall).returning();
  return created;
}

/**
 * Get paywall configuration for a block
 */
export async function getPaywallByBlockId(blockId: number): Promise<PaywallWithOwner | null> {
  const result = await db
    .select({
      id: paywalls.id,
      blockId: paywalls.blockId,
      ownerUserId: paywalls.ownerUserId,
      priceUsdc: paywalls.priceUsdc,
      recipientWallet: paywalls.recipientWallet,
      active: paywalls.active,
      createdAt: paywalls.createdAt,
      updatedAt: paywalls.updatedAt,
      ownerUsername: users.arenaUsername,
      ownerSlug: users.arenaSlug,
    })
    .from(paywalls)
    .leftJoin(users, eq(paywalls.ownerUserId, users.id))
    .where(eq(paywalls.blockId, blockId))
    .limit(1);

  if (result.length === 0) return null;

  return result[0] as PaywallWithOwner;
}

/**
 * Get all paywalls owned by a user
 */
export async function getPaywallsByOwner(userId: string): Promise<Paywall[]> {
  return db
    .select()
    .from(paywalls)
    .where(eq(paywalls.ownerUserId, userId));
}

/**
 * Update paywall configuration
 */
export async function updatePaywall(
  blockId: number,
  ownerUserId: string,
  updates: UpdatePaywallParams
): Promise<Paywall | null> {
  // Verify ownership
  const existing = await getPaywallByBlockId(blockId);
  if (!existing) {
    throw new PaywallError("Paywall not found", "NOT_FOUND");
  }
  if (existing.ownerUserId !== ownerUserId) {
    throw new PaywallError("You do not own this paywall", "FORBIDDEN");
  }

  // Validate price if provided
  if (updates.priceUsdc !== undefined) {
    if (parseFloat(updates.priceUsdc) < parseFloat(MIN_PRICE_USDC)) {
      throw new PaywallError(`Minimum price is ${MIN_PRICE_USDC} USDC`, "INVALID_PRICE");
    }
  }

  // Validate wallet if provided
  if (updates.recipientWallet !== undefined) {
    if (!isValidEthereumAddress(updates.recipientWallet)) {
      throw new PaywallError("Invalid recipient wallet address", "INVALID_WALLET");
    }
  }

  const [updated] = await db
    .update(paywalls)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(paywalls.blockId, blockId))
    .returning();

  return updated ?? null;
}

/**
 * Deactivate paywall (soft delete)
 */
export async function deactivatePaywall(blockId: number, ownerUserId: string): Promise<void> {
  const existing = await getPaywallByBlockId(blockId);
  if (!existing) {
    throw new PaywallError("Paywall not found", "NOT_FOUND");
  }
  if (existing.ownerUserId !== ownerUserId) {
    throw new PaywallError("You do not own this paywall", "FORBIDDEN");
  }

  await db
    .update(paywalls)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(paywalls.blockId, blockId));
}

/**
 * Delete paywall (hard delete)
 */
export async function deletePaywall(blockId: number, ownerUserId: string): Promise<void> {
  const existing = await getPaywallByBlockId(blockId);
  if (!existing) {
    throw new PaywallError("Paywall not found", "NOT_FOUND");
  }
  if (existing.ownerUserId !== ownerUserId) {
    throw new PaywallError("You do not own this paywall", "FORBIDDEN");
  }

  await db.delete(paywalls).where(eq(paywalls.blockId, blockId));
}

/**
 * Get paywall info for multiple blocks (batch lookup for efficiency)
 */
export async function getPaywallsForBlocks(
  blockIds: number[]
): Promise<Map<number, { priceUsdc: string; active: boolean }>> {
  if (blockIds.length === 0) return new Map();

  const results = await db
    .select({
      blockId: paywalls.blockId,
      priceUsdc: paywalls.priceUsdc,
      active: paywalls.active,
    })
    .from(paywalls)
    .where(
      and(
        eq(paywalls.active, true),
        // Using raw SQL for IN clause with Drizzle
      )
    );

  // For simplicity, we'll do individual lookups and cache
  // In production, use a proper IN clause
  const paywallMap = new Map<number, { priceUsdc: string; active: boolean }>();

  for (const id of blockIds) {
    const paywall = await db
      .select({
        blockId: paywalls.blockId,
        priceUsdc: paywalls.priceUsdc,
        active: paywalls.active,
      })
      .from(paywalls)
      .where(and(eq(paywalls.blockId, id), eq(paywalls.active, true)))
      .limit(1);

    if (paywall.length > 0) {
      paywallMap.set(id, {
        priceUsdc: paywall[0].priceUsdc,
        active: paywall[0].active,
      });
    }
  }

  return paywallMap;
}

/**
 * Verify user owns a block on Are.na
 */
export async function verifyBlockOwnership(
  arenaUserId: number,
  blockId: number,
  accessToken?: string
): Promise<boolean> {
  try {
    const client = new ArenaClient(accessToken);
    const block = await client.getBlock(blockId);
    return block.user?.id === arenaUserId;
  } catch {
    return false;
  }
}

/**
 * Custom error class for paywall operations
 */
export class PaywallError extends Error {
  constructor(
    message: string,
    public code:
      | "INVALID_PRICE"
      | "INVALID_WALLET"
      | "NO_WALLET"
      | "ALREADY_EXISTS"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "NOT_OWNER"
  ) {
    super(message);
    this.name = "PaywallError";
  }
}
