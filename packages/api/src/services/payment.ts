import { eq } from "drizzle-orm";
import { db, payments, paywalls, type Payment, type NewPayment } from "../db/index.js";

export type PaymentStatus = "pending" | "settled" | "failed";

export interface RecordPaymentParams {
  paywallId: string;
  payerWallet: string;
  amountUsdc: string;
  payerUserId?: string;
}

/**
 * Record a new pending payment
 */
export async function recordPayment(params: RecordPaymentParams): Promise<Payment> {
  const { paywallId, payerWallet, amountUsdc, payerUserId } = params;

  const newPayment: NewPayment = {
    paywallId,
    payerWallet: payerWallet.toLowerCase(),
    amountUsdc,
    payerUserId: payerUserId ?? null,
    status: "pending",
  };

  const [created] = await db.insert(payments).values(newPayment).returning();
  return created;
}

/**
 * Mark a payment as settled with transaction hash
 */
export async function settlePayment(paymentId: string, txHash: string): Promise<Payment | null> {
  const [updated] = await db
    .update(payments)
    .set({
      status: "settled",
      txHash,
      settledAt: new Date(),
    })
    .where(eq(payments.id, paymentId))
    .returning();

  return updated ?? null;
}

/**
 * Mark a payment as failed with optional reason
 */
export async function failPayment(paymentId: string, _reason?: string): Promise<Payment | null> {
  const [updated] = await db
    .update(payments)
    .set({
      status: "failed",
    })
    .where(eq(payments.id, paymentId))
    .returning();

  return updated ?? null;
}

/**
 * Get payment by ID
 */
export async function getPaymentById(paymentId: string): Promise<Payment | null> {
  const result = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get all payments for a paywall
 */
export async function getPaymentsByPaywall(paywallId: string): Promise<Payment[]> {
  return db
    .select()
    .from(payments)
    .where(eq(payments.paywallId, paywallId));
}

/**
 * Get all payments by a wallet address
 */
export async function getPaymentsByWallet(walletAddress: string): Promise<Payment[]> {
  return db
    .select()
    .from(payments)
    .where(eq(payments.payerWallet, walletAddress.toLowerCase()));
}

/**
 * Get payment stats for a paywall
 */
export interface PaywallStats {
  totalPayments: number;
  totalSettled: number;
  totalRevenue: string;
}

export async function getPaywallStats(paywallId: string): Promise<PaywallStats> {
  const allPayments = await getPaymentsByPaywall(paywallId);

  const settledPayments = allPayments.filter((p) => p.status === "settled");
  const totalRevenue = settledPayments.reduce(
    (sum, p) => sum + parseFloat(p.amountUsdc),
    0
  );

  return {
    totalPayments: allPayments.length,
    totalSettled: settledPayments.length,
    totalRevenue: totalRevenue.toFixed(6),
  };
}

/**
 * USDC conversion helpers
 * USDC has 6 decimal places
 */
export function usdcToAtomic(usdc: string): string {
  return (parseFloat(usdc) * 1_000_000).toFixed(0);
}

export function atomicToUsdc(atomic: string): string {
  return (parseInt(atomic, 10) / 1_000_000).toFixed(6);
}
