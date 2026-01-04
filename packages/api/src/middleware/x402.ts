import type { Request, Response, NextFunction } from "express";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import {
  encodePaymentRequiredHeader,
  decodePaymentSignatureHeader,
} from "@x402/core/http";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import type { PaymentPayload, PaymentRequirements, Network } from "@x402/core/types";
import { env } from "../config.js";
import { getPaywallByBlockId, type PaywallWithOwner } from "../services/paywall.js";
import { hasAccess, grantAccess } from "../services/accessGrant.js";
import { recordPayment, settlePayment, failPayment, usdcToAtomic } from "../services/payment.js";
import type { AuthenticatedRequest } from "./auth.js";

// Initialize x402 server singleton
let x402Server: x402ResourceServer | null = null;
let initializationPromise: Promise<void> | null = null;

async function getX402Server(): Promise<x402ResourceServer> {
  if (x402Server) return x402Server;

  if (initializationPromise) {
    await initializationPromise;
    return x402Server!;
  }

  initializationPromise = (async () => {
    const facilitator = new HTTPFacilitatorClient({
      url: env.facilitatorUrl,
    });

    x402Server = new x402ResourceServer(facilitator);
    registerExactEvmScheme(x402Server, {
      networks: [env.baseNetworkId as Network],
    });

    await x402Server.initialize();
    console.log("x402 server initialized with facilitator:", env.facilitatorUrl);
  })();

  await initializationPromise;
  return x402Server!;
}

// Initialize on module load
getX402Server().catch((err) => {
  console.error("Failed to initialize x402 server:", err);
});

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  txHash?: string;
  payer?: string;
  error?: string;
}

/**
 * Generate x402 payment requirements for a paywall
 */
function generatePaymentRequirements(
  paywall: PaywallWithOwner,
  blockId: number,
  resourcePath: string
): {
  scheme: string;
  network: Network;
  payTo: string;
  price: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
} {
  return {
    scheme: "exact",
    network: env.baseNetworkId as Network,
    payTo: paywall.recipientWallet,
    price: paywall.priceUsdc, // Will be converted to atomic units by ExactEvmScheme
    maxTimeoutSeconds: 300, // 5 minutes
    extra: {
      blockId,
      name: `Block ${blockId}`,
      ownerUsername: paywall.ownerUsername ?? undefined,
    },
  };
}

/**
 * Extract wallet address from request (header, query, or JWT)
 */
function getWalletFromRequest(req: AuthenticatedRequest): string | undefined {
  const headerWallet = req.headers["x-wallet-address"] as string | undefined;
  if (headerWallet) return headerWallet.toLowerCase();

  const queryWallet = req.query.wallet as string | undefined;
  if (queryWallet) return queryWallet.toLowerCase();

  if (req.user?.walletAddress) {
    return req.user.walletAddress.toLowerCase();
  }

  return undefined;
}

/**
 * x402 payment middleware for dynamic per-block pricing
 *
 * This middleware handles the x402 payment flow:
 * 1. Check if block has a paywall
 * 2. Check if user already has access
 * 3. If payment header present, verify and settle
 * 4. If no payment, return 402 with X-Payment header
 */
export async function x402PaywallMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract block ID from params
    const blockId = parseInt(req.params.id, 10);
    if (isNaN(blockId)) {
      return next(); // Let route handler deal with invalid ID
    }

    // Check if block has a paywall
    const paywall = await getPaywallByBlockId(blockId);
    if (!paywall || !paywall.active) {
      return next(); // No paywall, continue to route handler
    }

    // Get wallet address
    const walletAddress = getWalletFromRequest(req as AuthenticatedRequest);

    // Check if user already has access
    if (walletAddress) {
      const hasAccessResult = await hasAccess(blockId, walletAddress);
      if (hasAccessResult) {
        return next(); // Already has access
      }
    }

    // Check for payment header
    const paymentHeader = req.headers["x-payment"] as string | undefined;

    if (!paymentHeader) {
      // No payment provided, return 402 with payment requirements
      await return402Response(req, res, paywall, blockId);
      return;
    }

    // Verify and settle payment
    const result = await processPayment(req, paywall, blockId, walletAddress);

    if (!result.success) {
      res.status(400).json({
        error: "Payment failed",
        message: result.error,
      });
      return;
    }

    // Add payment receipt header
    if (result.txHash) {
      res.setHeader("X-Payment-Receipt", JSON.stringify({
        paymentId: result.paymentId,
        txHash: result.txHash,
        network: env.baseNetworkId,
        payer: result.payer,
      }));
    }

    // Continue to route handler
    next();
  } catch (error) {
    console.error("x402 middleware error:", error);
    res.status(500).json({
      error: "Payment processing error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Return 402 response with X-Payment header
 */
async function return402Response(
  req: Request,
  res: Response,
  paywall: PaywallWithOwner,
  blockId: number
): Promise<void> {
  const server = await getX402Server();
  const resourcePath = `/v2/blocks/${blockId}`;

  const config = generatePaymentRequirements(paywall, blockId, resourcePath);

  // Build payment requirements
  const requirements = await server.buildPaymentRequirements({
    scheme: config.scheme,
    network: config.network,
    payTo: config.payTo,
    price: config.price,
    maxTimeoutSeconds: config.maxTimeoutSeconds,
  });

  // Add extra metadata to requirements
  for (const req of requirements) {
    req.extra = { ...req.extra, ...config.extra };
  }

  // Create payment required response
  const paymentRequired = server.createPaymentRequiredResponse(
    requirements,
    {
      url: resourcePath,
      description: `Access to block ${blockId}`,
      mimeType: "application/json",
    },
    "Payment required to access this content"
  );

  // Encode as base64 header
  const xPaymentHeader = encodePaymentRequiredHeader(paymentRequired);

  res.status(402)
    .setHeader("X-Payment", xPaymentHeader)
    .json({
      error: "Payment required",
      message: "This block requires payment to access",
      paywall: {
        blockId,
        priceUsdc: paywall.priceUsdc,
        currency: "USDC",
        network: "base",
        recipientWallet: paywall.recipientWallet,
        ownerUsername: paywall.ownerUsername,
      },
    });
}

/**
 * Process payment from X-Payment header
 */
async function processPayment(
  req: Request,
  paywall: PaywallWithOwner,
  blockId: number,
  walletAddress?: string
): Promise<PaymentResult> {
  const server = await getX402Server();
  const paymentHeader = req.headers["x-payment"] as string;

  let paymentPayload: PaymentPayload;
  try {
    paymentPayload = decodePaymentSignatureHeader(paymentHeader);
  } catch (error) {
    return {
      success: false,
      error: "Invalid payment header format",
    };
  }

  // Get the payment requirements that were accepted
  const acceptedRequirements = paymentPayload.accepted;

  // Verify the payment matches our paywall config
  const expectedAmount = usdcToAtomic(paywall.priceUsdc);
  if (acceptedRequirements.amount !== expectedAmount) {
    return {
      success: false,
      error: `Payment amount mismatch. Expected ${expectedAmount}, got ${acceptedRequirements.amount}`,
    };
  }

  if (acceptedRequirements.payTo.toLowerCase() !== paywall.recipientWallet.toLowerCase()) {
    return {
      success: false,
      error: "Payment recipient mismatch",
    };
  }

  // Record pending payment
  const payerWallet = walletAddress || paymentPayload.payload?.payer as string || "unknown";
  const payment = await recordPayment({
    paywallId: paywall.id,
    payerWallet,
    amountUsdc: paywall.priceUsdc,
  });

  try {
    // Verify payment signature
    const verifyResult = await server.verifyPayment(paymentPayload, acceptedRequirements);

    if (!verifyResult.isValid) {
      await failPayment(payment.id, verifyResult.invalidReason);
      return {
        success: false,
        error: verifyResult.invalidReason || "Payment verification failed",
      };
    }

    // Settle payment on-chain
    const settleResult = await server.settlePayment(paymentPayload, acceptedRequirements);

    if (!settleResult.success) {
      await failPayment(payment.id, settleResult.errorReason);
      return {
        success: false,
        error: settleResult.errorReason || "Payment settlement failed",
      };
    }

    // Mark payment as settled
    await settlePayment(payment.id, settleResult.transaction);

    // Grant access to the block
    const actualPayer = settleResult.payer || verifyResult.payer || payerWallet;
    await grantAccess(blockId, actualPayer, payment.id);

    return {
      success: true,
      paymentId: payment.id,
      txHash: settleResult.transaction,
      payer: actualPayer,
    };
  } catch (error) {
    await failPayment(payment.id, error instanceof Error ? error.message : "Unknown error");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Payment processing failed",
    };
  }
}

/**
 * Check if request has valid payment that can be processed
 */
export function hasPaymentHeader(req: Request): boolean {
  return !!req.headers["x-payment"];
}
