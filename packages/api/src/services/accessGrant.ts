import { eq, and } from "drizzle-orm";
import { db, accessGrants, paywalls, type AccessGrant, type NewAccessGrant } from "../db/index.js";

/**
 * Check if a wallet has access to a block
 */
export async function hasAccess(blockId: number, walletAddress: string): Promise<boolean> {
  if (!walletAddress) return false;

  const normalizedWallet = walletAddress.toLowerCase();

  const result = await db
    .select({ id: accessGrants.id })
    .from(accessGrants)
    .where(
      and(
        eq(accessGrants.blockId, blockId),
        eq(accessGrants.payerWallet, normalizedWallet)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Grant access to a block for a wallet
 */
export async function grantAccess(
  blockId: number,
  walletAddress: string,
  paymentId?: string
): Promise<AccessGrant> {
  const normalizedWallet = walletAddress.toLowerCase();

  // Check if access already granted
  const existing = await db
    .select()
    .from(accessGrants)
    .where(
      and(
        eq(accessGrants.blockId, blockId),
        eq(accessGrants.payerWallet, normalizedWallet)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const newGrant: NewAccessGrant = {
    blockId,
    payerWallet: normalizedWallet,
    paymentId: paymentId ?? null,
  };

  const [created] = await db.insert(accessGrants).values(newGrant).returning();
  return created;
}

/**
 * Revoke access to a block for a wallet (admin only)
 */
export async function revokeAccess(blockId: number, walletAddress: string): Promise<boolean> {
  const normalizedWallet = walletAddress.toLowerCase();

  const result = await db
    .delete(accessGrants)
    .where(
      and(
        eq(accessGrants.blockId, blockId),
        eq(accessGrants.payerWallet, normalizedWallet)
      )
    )
    .returning();

  return result.length > 0;
}

/**
 * Get all blocks a wallet has access to
 */
export async function getAccessGrantsByWallet(walletAddress: string): Promise<AccessGrant[]> {
  const normalizedWallet = walletAddress.toLowerCase();

  return db
    .select()
    .from(accessGrants)
    .where(eq(accessGrants.payerWallet, normalizedWallet));
}

/**
 * Get all wallets with access to a block
 */
export async function getAccessGrantsByBlock(blockId: number): Promise<AccessGrant[]> {
  return db
    .select()
    .from(accessGrants)
    .where(eq(accessGrants.blockId, blockId));
}

/**
 * Check access for multiple blocks at once (batch lookup)
 */
export async function checkAccessForBlocks(
  blockIds: number[],
  walletAddress: string
): Promise<Set<number>> {
  if (!walletAddress || blockIds.length === 0) return new Set();

  const normalizedWallet = walletAddress.toLowerCase();
  const accessibleBlocks = new Set<number>();

  // Get all access grants for this wallet
  const grants = await db
    .select({ blockId: accessGrants.blockId })
    .from(accessGrants)
    .where(eq(accessGrants.payerWallet, normalizedWallet));

  for (const grant of grants) {
    if (blockIds.includes(grant.blockId)) {
      accessibleBlocks.add(grant.blockId);
    }
  }

  return accessibleBlocks;
}

/**
 * Get access status for a block including paywall info
 */
export interface BlockAccessStatus {
  blockId: number;
  isPaywalled: boolean;
  hasAccess: boolean;
  priceUsdc?: string;
  recipientWallet?: string;
}

export async function getBlockAccessStatus(
  blockId: number,
  walletAddress?: string
): Promise<BlockAccessStatus> {
  // Check if block has a paywall
  const paywall = await db
    .select({
      priceUsdc: paywalls.priceUsdc,
      recipientWallet: paywalls.recipientWallet,
      active: paywalls.active,
    })
    .from(paywalls)
    .where(and(eq(paywalls.blockId, blockId), eq(paywalls.active, true)))
    .limit(1);

  if (paywall.length === 0) {
    return {
      blockId,
      isPaywalled: false,
      hasAccess: true, // No paywall means free access
    };
  }

  // Block is paywalled, check if wallet has access
  let walletHasAccess = false;
  if (walletAddress) {
    walletHasAccess = await hasAccess(blockId, walletAddress);
  }

  return {
    blockId,
    isPaywalled: true,
    hasAccess: walletHasAccess,
    priceUsdc: paywall[0].priceUsdc,
    recipientWallet: paywall[0].recipientWallet,
  };
}
