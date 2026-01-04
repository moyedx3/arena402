/**
 * x402 Payment Flow Test Script
 *
 * This script demonstrates how to:
 * 1. Request a paywalled block and receive 402
 * 2. Decode the X-Payment header
 * 3. (With a real wallet) Sign and submit payment
 *
 * Usage:
 *   npx tsx scripts/test-x402.ts <blockId>
 */

const API_URL = process.env.API_URL || "http://localhost:3000";

async function testPaywallFlow(blockId: number) {
  console.log(`\n🔍 Testing paywall flow for block ${blockId}...\n`);

  // Step 1: Request the block without payment
  console.log("Step 1: Requesting block without payment...");
  const response = await fetch(`${API_URL}/v2/blocks/${blockId}`);

  console.log(`   Status: ${response.status} ${response.statusText}`);

  if (response.status === 200) {
    console.log("   ✅ Block is NOT paywalled - access granted");
    const block = await response.json();
    console.log(`   Block title: ${block.title || block.generated_title || "Untitled"}`);
    return;
  }

  if (response.status !== 402) {
    console.log(`   ❌ Unexpected status: ${response.status}`);
    console.log(await response.text());
    return;
  }

  console.log("   ✅ Received 402 Payment Required (expected)\n");

  // Step 2: Check X-Payment header
  const xPaymentHeader = response.headers.get("X-Payment");
  if (!xPaymentHeader) {
    console.log("   ❌ Missing X-Payment header!");
    return;
  }

  console.log("Step 2: Decoding X-Payment header...");
  const paymentRequired = JSON.parse(
    Buffer.from(xPaymentHeader, "base64").toString("utf-8")
  );

  console.log("   ✅ Payment requirements decoded:\n");
  console.log(JSON.stringify(paymentRequired, null, 2));

  // Step 3: Parse body for human-readable info
  const body = await response.json();
  console.log("\n   Paywall details:");
  console.log(`   - Block ID: ${body.paywall.blockId}`);
  console.log(`   - Price: ${body.paywall.priceUsdc} USDC`);
  console.log(`   - Network: ${body.paywall.network}`);
  console.log(`   - Recipient: ${body.paywall.recipientWallet}`);

  // Step 4: Show what's needed for actual payment
  console.log("\n📝 To complete payment, you need:");
  console.log("   1. A wallet with testnet USDC on Base Sepolia");
  console.log("   2. An x402-compatible client (like @x402/fetch)");
  console.log("   3. Sign the payment with your wallet");
  console.log("   4. Send request with X-Payment header containing signed payment\n");

  // Show example code
  console.log("Example using @x402/fetch:");
  console.log(`
import { wrapFetchWithPayments } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0xYOUR_PRIVATE_KEY");
const evmScheme = new ExactEvmScheme({ address: account.address, signTypedData: ... });

const x402Fetch = wrapFetchWithPayments(fetch, { "eip155:84532": evmScheme });

const response = await x402Fetch("${API_URL}/v2/blocks/${blockId}");
const block = await response.json();
console.log(block);
  `);
}

// Main
const blockId = parseInt(process.argv[2] || "0", 10);
if (!blockId) {
  console.log("Usage: npx tsx scripts/test-x402.ts <blockId>");
  console.log("\nFirst, create a paywall for a block using the API:");
  console.log("  1. Log in via /auth/arena");
  console.log("  2. POST /paywall/configure with { blockId, priceUsdc }");
  console.log("  3. Run this script with that block ID");
  process.exit(1);
}

testPaywallFlow(blockId)
  .then(() => console.log("\n✨ Test complete!"))
  .catch((err) => console.error("Error:", err));
