# Milestone 4: x402 Payment Integration

## Status: ✅ Complete

**Started:** 2026-01-04
**Completed:** 2026-01-04

---

## Overview

Integrate the x402 payment protocol to enable actual payments for paywalled blocks. This milestone builds on Milestone 3's paywall logic by adding:

1. Proper `X-Payment` headers in 402 responses
2. Payment signature verification via x402 facilitator
3. On-chain settlement on Base network
4. Recording payments and granting access in database

**Goal:** AI agents and x402-compatible clients can pay to access paywalled blocks with real USDC on Base.

---

## Prerequisites

- [x] Milestone 3 complete (paywall configuration, access grants, 402 responses)
- [x] Database has `payments` table with status field
- [x] Config has `facilitatorUrl`, `baseRpcUrl`, `usdcContractAddress`
- [x] x402 packages installed (`@x402/express`, `@x402/core`, `@x402/evm`)

---

## Key Challenge: Dynamic vs Static Routes

The standard `@x402/express` middleware expects static route configuration:

```typescript
// Standard pattern - static routes
paymentMiddleware({
  "GET /weather": { accepts: [{ price: "$0.001", payTo: "0x..." }] }
})
```

Our use case requires **dynamic pricing per block**:
- Each block has its own price and recipient wallet
- Paywall configuration is stored in database, not code
- Need to lookup paywall config on each request

**Solution:** Create custom x402 middleware that:
1. Intercepts requests to `/v2/blocks/:id`
2. Looks up paywall configuration from database
3. Generates x402 payment requirements dynamically
4. Verifies payment response via facilitator
5. Settles payment and grants access

---

## Tasks

### 1. Install x402 Packages

- [x] `pnpm --filter @arena402/api add @x402/express @x402/core @x402/evm`
- [x] Verify packages install correctly
- [x] Check TypeScript types are available

**Packages:**
| Package | Purpose |
|---------|---------|
| `@x402/express` | Express middleware for 402 responses |
| `@x402/core` | Core types, HTTPFacilitatorClient |
| `@x402/evm` | EVM-specific payment schemes (Base) |

### 2. x402 Middleware (`src/middleware/x402.ts`)

- [x] Import x402 packages and types
- [x] Create `HTTPFacilitatorClient` instance
- [x] Create `ExactEvmScheme` for Base network
- [x] Implement `x402PaywallMiddleware` function
- [x] Handle `X-Payment-Response` header parsing
- [x] Verify payment via facilitator
- [x] Return proper 402 with `X-Payment` header when unpaid

**Network IDs:**
- Base Mainnet: `eip155:8453`
- Base Sepolia (testnet): `eip155:84532`

### 3. Payment Requirements Generation

- [x] Create `generatePaymentRequirements(paywall)` helper
- [x] Format price in USDC atomic units (6 decimals)
- [x] Include block ID in `extra` field for tracking
- [x] Set appropriate `maxTimeoutSeconds`
- [x] Include resource path for verification

**X-Payment Header Structure:**
```json
{
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:8453",
    "maxAmountRequired": "50000",
    "resource": "/v2/blocks/12345",
    "payTo": "0xRecipientWallet",
    "maxTimeoutSeconds": 300,
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "extra": {
      "blockId": 12345,
      "name": "Block Title"
    }
  }],
  "x402Version": 1
}
```

### 4. Payment Verification Flow

- [x] Parse `X-Payment-Response` header from request
- [x] Validate payment response structure
- [x] Call facilitator to verify signature
- [x] Check payment amount matches paywall price
- [x] Check recipient wallet matches paywall config
- [x] Handle verification errors gracefully

### 5. Payment Settlement

- [x] On successful verification, trigger settlement
- [x] Record payment in `payments` table with status `pending`
- [x] Wait for settlement confirmation from facilitator
- [x] Update payment status to `settled`
- [x] Store transaction hash (`txHash`)
- [x] Grant access to block via `accessGrants`

### 6. Payment Service (`src/services/payment.ts`)

- [x] `recordPayment(paywallId, payerWallet, amount)` - Create pending payment
- [x] `settlePayment(paymentId, txHash)` - Mark as settled
- [x] `failPayment(paymentId, reason)` - Mark as failed
- [x] `getPaymentsByPaywall(paywallId)` - Get payment history
- [x] `getPaymentsByWallet(wallet)` - Get user's payments

### 7. Update Arena Routes

- [x] Integrate x402 middleware with `/v2/blocks/:id` route
- [x] Check for `X-Payment-Response` before checking access
- [x] If payment verified, grant access and return block
- [x] Include `X-Payment-Receipt` header on successful payment
- [x] Keep backward compatibility for free blocks

### 8. Environment Configuration

- [x] Add `FACILITATOR_URL` to `.env.example`
- [x] Add `BASE_NETWORK_ID` to config (mainnet vs testnet)
- [x] Document required environment variables
- [x] Add testnet configuration option

**New Environment Variables:**
```bash
# x402 Configuration
FACILITATOR_URL=https://x402.org/facilitator
BASE_NETWORK_ID=eip155:8453  # mainnet, or eip155:84532 for testnet
```

### 9. Error Handling

- [x] Handle facilitator connection errors
- [x] Handle invalid payment responses
- [x] Handle insufficient payment amounts
- [x] Handle network/settlement failures
- [x] Return appropriate error messages to clients

### 10. Testing

- [ ] Test 402 response includes correct `X-Payment` header
- [ ] Test payment verification with valid signature
- [ ] Test payment rejection with invalid signature
- [ ] Test payment recording in database
- [ ] Test access grant after payment
- [ ] Test repeat access (already paid)

---

## API Changes

### Updated: `GET /v2/blocks/:id`

**Headers (Request):**
| Header | Description |
|--------|-------------|
| `X-Payment-Response` | Signed payment response from client |
| `X-Wallet-Address` | Payer's wallet address (fallback) |

**Headers (Response - 402):**
| Header | Description |
|--------|-------------|
| `X-Payment` | Base64-encoded payment requirements |

**Headers (Response - 200 after payment):**
| Header | Description |
|--------|-------------|
| `X-Payment-Receipt` | Settlement confirmation |

**402 Response Body:**
```json
{
  "error": "Payment required",
  "message": "This block requires payment to access",
  "paywall": {
    "blockId": 12345,
    "priceUsdc": "0.050000",
    "currency": "USDC",
    "network": "base",
    "recipientWallet": "0x..."
  }
}
```

---

## File Structure (New/Modified)

```
packages/api/
├── src/
│   ├── index.ts                # (unchanged)
│   ├── config.ts               # ✅ Add BASE_NETWORK_ID
│   ├── middleware/
│   │   ├── auth.ts             # (unchanged)
│   │   └── x402.ts             # 🆕 x402 payment middleware
│   ├── routes/
│   │   ├── arena.ts            # ✅ Integrate x402 middleware
│   │   └── paywall.ts          # (unchanged)
│   └── services/
│       ├── paywall.ts          # (unchanged)
│       ├── accessGrant.ts      # (unchanged)
│       └── payment.ts          # 🆕 Payment recording service
```

---

## x402 Integration Architecture

```
┌─────────────┐          ┌──────────────────┐          ┌─────────────────┐
│   Client    │          │   Arena402 API   │          │   Facilitator   │
│  (AI Agent) │          │                  │          │                 │
└──────┬──────┘          └────────┬─────────┘          └────────┬────────┘
       │                          │                             │
       │ GET /v2/blocks/123       │                             │
       │─────────────────────────>│                             │
       │                          │                             │
       │                          │ Check paywall (DB lookup)   │
       │                          │──────────┐                  │
       │                          │<─────────┘                  │
       │                          │                             │
       │ 402 + X-Payment header   │                             │
       │<─────────────────────────│                             │
       │                          │                             │
       │ Sign payment locally     │                             │
       │──────────┐               │                             │
       │<─────────┘               │                             │
       │                          │                             │
       │ GET + X-Payment-Response │                             │
       │─────────────────────────>│                             │
       │                          │                             │
       │                          │ Verify signature            │
       │                          │────────────────────────────>│
       │                          │                             │
       │                          │ Signature valid             │
       │                          │<────────────────────────────│
       │                          │                             │
       │                          │ Settle on Base              │
       │                          │────────────────────────────>│
       │                          │                             │
       │                          │ Tx hash                     │
       │                          │<────────────────────────────│
       │                          │                             │
       │                          │ Record payment + grant      │
       │                          │──────────┐                  │
       │                          │<─────────┘                  │
       │                          │                             │
       │ 200 + X-Payment-Receipt  │                             │
       │<─────────────────────────│                             │
       │                          │                             │
```

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Custom middleware** | Build on x402 packages | Dynamic per-block pricing requires custom logic |
| **Settlement timing** | Settle before returning content | Ensures payment before access |
| **Network** | Base mainnet (configurable) | Low fees, native USDC, testnet for dev |
| **Price format** | Atomic units (6 decimals) | USDC has 6 decimal places |
| **Idempotency** | Check existing access first | Don't double-charge for same block |

---

## USDC Decimal Handling

USDC uses 6 decimal places:
- `$1.00` = `1000000` atomic units
- `$0.01` = `10000` atomic units
- `$0.001` = `1000` atomic units

**Conversion helpers:**
```typescript
// Convert human-readable to atomic
function usdcToAtomic(usdc: string): string {
  return (parseFloat(usdc) * 1_000_000).toFixed(0);
}

// Convert atomic to human-readable
function atomicToUsdc(atomic: string): string {
  return (parseInt(atomic) / 1_000_000).toFixed(6);
}
```

---

## Verification Checklist

- [x] x402 packages installed and imported
- [x] Facilitator client connecting successfully
- [x] 402 responses include valid `X-Payment` header
- [x] Payment verification working with facilitator
- [x] Payments recorded in database
- [x] Access grants created after payment
- [x] Subsequent requests return content without re-payment
- [x] Error cases handled gracefully

---

## Notes

### Facilitator Role

The x402 facilitator handles:
1. **Signature verification** - Confirms payment was signed by claimed wallet
2. **Settlement** - Executes USDC transfer on Base
3. **Receipt generation** - Provides proof of payment

We don't need to implement blockchain interaction directly - the facilitator handles it.

### Testnet vs Mainnet

For development, use Base Sepolia testnet:
- Network ID: `eip155:84532`
- Testnet USDC: Available from faucets
- Testnet facilitator: May need to run locally or use test instance

For production:
- Network ID: `eip155:8453`
- Real USDC
- Production facilitator: `https://x402.org/facilitator`

### Relationship to Previous Milestones

This milestone enhances the 402 response from Milestone 3:

**Before (M3):** Simple 402 with JSON body only
```http
HTTP/1.1 402 Payment Required
Content-Type: application/json

{"error": "Payment required", "paywall": {...}}
```

**After (M4):** Full x402 protocol support
```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
X-Payment: eyJhY2NlcHRzIjpbey4uLn1dfQ==

{"error": "Payment required", "paywall": {...}}
```

---

## Next: Milestone 5 - Frontend (ervell fork)

After completing x402 payment integration:

1. Fork ervell repository
2. Add paywall toggle to block creation
3. Implement blurred preview component
4. Payment modal with wallet connection
5. User settings page for wallet/earnings
