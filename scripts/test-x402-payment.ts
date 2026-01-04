#!/usr/bin/env npx tsx
/**
 * x402 Full Payment Flow Test Script
 *
 * This script demonstrates the complete x402 payment flow:
 * 1. Request a paywalled block → receive 402
 * 2. Automatically sign payment with wallet
 * 3. Submit payment → receive content
 *
 * Prerequisites:
 * - Base Sepolia testnet USDC in your wallet
 * - Get testnet USDC from: https://faucet.circle.com/ (select Base Sepolia)
 *
 * Usage:
 *   # Set your test wallet private key (WITHOUT 0x prefix or WITH)
 *   export TEST_PRIVATE_KEY="your_private_key_here"
 *
 *   # Run the test
 *   npx tsx scripts/test-x402-payment.ts <blockId>
 *
 * Example:
 *   export TEST_PRIVATE_KEY="ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
 *   npx tsx scripts/test-x402-payment.ts 12345
 */

import { createWalletClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayments } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";

// Configuration
const API_URL = process.env.API_URL || "http://localhost:3000";
const PRIVATE_KEY = process.env.TEST_PRIVATE_KEY;

// USDC contract on Base Sepolia
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

async function main() {
  const blockId = parseInt(process.argv[2] || "0", 10);

  if (!blockId) {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║              x402 Payment Flow Test Script                     ║
╚════════════════════════════════════════════════════════════════╝

Usage:
  export TEST_PRIVATE_KEY="your_private_key_here"
  npx tsx scripts/test-x402-payment.ts <blockId>

Prerequisites:
  1. A test wallet with Base Sepolia testnet USDC
  2. Get testnet USDC from: https://faucet.circle.com/
     (Select "Base Sepolia" network)
  3. A paywalled block in your local database

Example:
  # Use Hardhat's default test account (DO NOT use with real funds!)
  export TEST_PRIVATE_KEY="ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  npx tsx scripts/test-x402-payment.ts 12345
`);
    process.exit(1);
  }

  if (!PRIVATE_KEY) {
    console.error("❌ Error: TEST_PRIVATE_KEY environment variable not set");
    console.log("\nSet it with:");
    console.log('  export TEST_PRIVATE_KEY="your_private_key_here"');
    process.exit(1);
  }

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              x402 Payment Flow Test                            ║
╚════════════════════════════════════════════════════════════════╝
`);

  // Step 1: Set up wallet
  console.log("🔐 Step 1: Setting up wallet...\n");

  const formattedKey = PRIVATE_KEY.startsWith("0x")
    ? (PRIVATE_KEY as `0x${string}`)
    : (`0x${PRIVATE_KEY}` as `0x${string}`);

  const account = privateKeyToAccount(formattedKey);
  console.log(`   Wallet address: ${account.address}`);

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  // Step 2: Create x402 payment client
  console.log("\n💳 Step 2: Creating x402 payment client...\n");

  const signer = toClientEvmSigner(walletClient, account);
  const evmScheme = new ExactEvmScheme(signer);

  const x402Fetch = wrapFetchWithPayments(fetch, {
    "eip155:84532": evmScheme, // Base Sepolia
  });

  console.log("   ✅ x402 client ready for Base Sepolia (eip155:84532)");

  // Step 3: First, test without payment to see the 402 response
  console.log("\n📡 Step 3: Testing 402 response (without payment)...\n");

  const testResponse = await fetch(`${API_URL}/v2/blocks/${blockId}`);
  console.log(`   Status: ${testResponse.status} ${testResponse.statusText}`);

  if (testResponse.status === 200) {
    console.log("\n   ✅ Block is NOT paywalled - no payment needed!");
    const block = await testResponse.json();
    console.log(`   Block title: ${block.title || block.generated_title || "Untitled"}`);
    console.log("\n✨ Test complete (no payment required)");
    return;
  }

  if (testResponse.status !== 402) {
    console.log(`\n   ❌ Unexpected status: ${testResponse.status}`);
    const text = await testResponse.text();
    console.log(`   Response: ${text}`);
    return;
  }

  // Parse the 402 response
  const xPaymentHeader = testResponse.headers.get("X-Payment");
  const body = await testResponse.json();

  console.log("   ✅ Received 402 Payment Required");
  console.log(`\n   Paywall details:`);
  console.log(`   ├─ Block ID: ${body.paywall.blockId}`);
  console.log(`   ├─ Price: ${body.paywall.priceUsdc} USDC`);
  console.log(`   ├─ Network: ${body.paywall.network}`);
  console.log(`   └─ Recipient: ${body.paywall.recipientWallet}`);

  if (xPaymentHeader) {
    const decoded = JSON.parse(Buffer.from(xPaymentHeader, "base64").toString());
    console.log(`\n   X-Payment header decoded:`);
    console.log(`   ├─ x402 Version: ${decoded.x402Version}`);
    console.log(`   ├─ Schemes: ${decoded.accepts?.map((a: any) => a.scheme).join(", ")}`);
    console.log(`   └─ Networks: ${decoded.accepts?.map((a: any) => a.network).join(", ")}`);
  }

  // Step 4: Now make the actual payment
  console.log("\n💸 Step 4: Making payment with x402Fetch...\n");
  console.log("   This will:");
  console.log("   1. Receive 402 response");
  console.log("   2. Sign payment authorization with your wallet");
  console.log("   3. Submit signed payment to facilitator");
  console.log("   4. Facilitator settles on Base Sepolia");
  console.log("   5. Return the unlocked content\n");

  try {
    const startTime = Date.now();
    const response = await x402Fetch(`${API_URL}/v2/blocks/${blockId}`);
    const elapsed = Date.now() - startTime;

    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Time: ${elapsed}ms`);

    if (response.status === 200) {
      console.log("\n   ✅ Payment successful! Content unlocked.\n");

      // Check for payment receipt
      const receipt = response.headers.get("X-Payment-Receipt");
      if (receipt) {
        const receiptData = JSON.parse(receipt);
        console.log("   📜 Payment Receipt:");
        console.log(`   ├─ Payment ID: ${receiptData.paymentId}`);
        console.log(`   ├─ Tx Hash: ${receiptData.txHash}`);
        console.log(`   ├─ Network: ${receiptData.network}`);
        console.log(`   └─ Payer: ${receiptData.payer}`);

        if (receiptData.txHash) {
          console.log(`\n   🔗 View on BaseScan:`);
          console.log(`      https://sepolia.basescan.org/tx/${receiptData.txHash}`);
        }
      }

      // Show block content
      const block = await response.json();
      console.log("\n   📦 Block Content:");
      console.log(`   ├─ ID: ${block.id}`);
      console.log(`   ├─ Title: ${block.title || block.generated_title || "Untitled"}`);
      console.log(`   ├─ Class: ${block.class}`);
      if (block.content) {
        const preview = block.content.substring(0, 100);
        console.log(`   └─ Content: ${preview}${block.content.length > 100 ? "..." : ""}`);
      } else if (block.image) {
        console.log(`   └─ Image: ${block.image.display?.url || block.image.original?.url}`);
      }

      console.log("\n✨ Test complete! Payment flow working correctly.");
    } else {
      console.log("\n   ❌ Payment failed");
      const errorText = await response.text();
      console.log(`   Response: ${errorText}`);
    }
  } catch (error) {
    console.error("\n   ❌ Error during payment:", error);

    if (error instanceof Error) {
      if (error.message.includes("insufficient")) {
        console.log("\n   💡 Tip: You need testnet USDC on Base Sepolia");
        console.log("      Get some from: https://faucet.circle.com/");
      }
    }
  }
}

// Run
main().catch(console.error);
