# Arena x402: Monetize Your Taste

## Overview

Arena x402 enables Are.na users to monetize their curated content (blocks) via x402 payments on Base network (USDC). Both humans (via web UI) and AI agents (via API) can pay to access paywalled content.

**Core Value Proposition:** Creators earn from their curation work. AI agents pay for quality human-curated knowledge.

---

## Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1: Core Backend** | ✅ Complete | Express server, PostgreSQL, Drizzle ORM, Are.na proxy |
| **Phase 2: Authentication** | ✅ Complete | OAuth with Are.na, JWT sessions, wallet linking |
| **Phase 3: Paywall Logic** | ✅ Complete | Paywall configuration, access grants, 402 responses |
| **Phase 4: x402 Integration** | ✅ Complete | Full x402 protocol, payment verification, settlement |
| **Phase 5: Frontend** | ⏳ Pending | Fork ervell, add paywall UI |

---

## Problem Statement

Are.na is a platform where users curate knowledge, inspiration, and references into channels. This curation work has value, but currently there's no way for creators to monetize their taste and effort. Meanwhile, AI agents increasingly need access to high-quality, human-curated content.

**Solution:** Add a payment layer using the x402 protocol that:
1. Lets creators set per-block prices
2. Shows blurred previews to non-payers
3. Returns HTTP 402 to AI agents with x402 payment headers
4. Settles payments in USDC on Base

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                           ARENA x402 SYSTEM                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   [Browser]                              [AI Agent]                     │
│       │                                       │                         │
│       ▼                                       │                         │
│  ┌──────────────┐                             │                         │
│  │   Modified   │                             │                         │
│  │    ervell    │─────────────┐               │                         │
│  │  (Frontend)  │             │               │                         │
│  └──────────────┘             │               │                         │
│                               ▼               ▼                         │
│                        ┌─────────────────────────┐                      │
│                        │      x402 Proxy API     │                      │
│                        │   (Node.js/Express)     │                      │
│                        └───────────┬─────────────┘                      │
│                                    │                                    │
│            ┌───────────────────────┼───────────────────────┐            │
│            │                       │                       │            │
│            ▼                       ▼                       ▼            │
│     ┌────────────┐         ┌─────────────┐         ┌─────────────┐      │
│     │  Paywall   │         │   OAuth     │         │   x402      │      │
│     │  Database  │         │   with      │         │ Facilitator │      │
│     │ (Postgres) │         │   Are.na    │         │   (Base)    │      │
│     └────────────┘         └─────────────┘         └─────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │   Are.na API    │
                           │  (Unchanged)    │
                           └─────────────────┘
```

### Key Insight

We don't modify Are.na's backend (it's not open source). Instead, we:
1. **Fork the frontend** (ervell) to add paywall UI
2. **Build a proxy API** that sits between clients and Are.na
3. **Maintain our own database** for paywall configurations and payments

Content stays on Are.na. We only gate access to it.

---

## Components

### 1. Modified ervell Frontend (Fork)

**Purpose:** User-facing web app with paywall UI

**Key Modifications:**

| Feature | Description |
|---------|-------------|
| **Monetize toggle** | When creating a block, toggle "Monetize this block" |
| **Price input** | Set price in USDC (minimum $0.01) |
| **Wallet field** | Auto-filled from connected wallet |
| **Blurred preview** | Paywalled blocks show blurred content |
| **Payment modal** | "Pay $X to unlock" with wallet connection |
| **Settings page** | Manage wallet, view earnings |

**Tech:** TypeScript, React (existing ervell stack), Coinbase Wallet SDK

### 2. x402 Proxy API (New Backend)

**Purpose:** Gateway between clients and Are.na, enforcing payments

**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v2/channels/:slug` | GET | Proxy to Are.na, mark paywalled blocks |
| `/v2/channels/:slug/contents` | GET | Proxy channel contents with paywall info |
| `/v2/blocks/:id` | GET | Check paywall, return 402 if unpaid |
| `/v2/channels/:slug/blocks` | POST | Proxy create, optionally store paywall config |
| `/auth/arena` | GET | Initiate OAuth with Are.na |
| `/auth/arena/callback` | GET | OAuth callback |
| `/paywall/configure` | POST | Set paywall on existing block |
| `/paywall/:blockId` | GET | Get paywall config for a block |
| `/user/profile` | GET | Get current user profile |
| `/user/wallet` | PUT | Update wallet address |
| `/user/earnings` | GET | View payment history and earnings |

**Tech:** Node.js, Express, TypeScript, ethers.js

### 3. Database (PostgreSQL)

**Purpose:** Store users, paywall configs, and payment records

```sql
-- Users linked to Are.na accounts
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_user_id INTEGER UNIQUE NOT NULL,
  arena_username VARCHAR(255),
  arena_slug VARCHAR(255),
  arena_access_token TEXT,  -- encrypted
  wallet_address VARCHAR(42),  -- 0x...
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Paywall configurations
CREATE TABLE paywalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id INTEGER UNIQUE NOT NULL,  -- Are.na block ID
  owner_user_id UUID REFERENCES users(id),
  price_usdc DECIMAL(10,6) NOT NULL,  -- e.g., 0.010000
  recipient_wallet VARCHAR(42) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT price_minimum CHECK (price_usdc >= 0.01)
);

-- Payment records
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paywall_id UUID REFERENCES paywalls(id),
  payer_wallet VARCHAR(42) NOT NULL,
  payer_user_id UUID REFERENCES users(id),  -- NULL for AI agents
  amount_usdc DECIMAL(10,6) NOT NULL,
  tx_hash VARCHAR(66),  -- Base transaction hash
  status VARCHAR(20) DEFAULT 'pending',  -- pending, settled, failed
  settled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Access grants (tracks who has paid for what)
CREATE TABLE access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id INTEGER NOT NULL,
  payer_wallet VARCHAR(42) NOT NULL,
  payment_id UUID REFERENCES payments(id),
  granted_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(block_id, payer_wallet)
);

-- Indexes for performance
CREATE INDEX idx_paywalls_block_id ON paywalls(block_id);
CREATE INDEX idx_paywalls_owner ON paywalls(owner_user_id);
CREATE INDEX idx_access_grants_block ON access_grants(block_id);
CREATE INDEX idx_access_grants_wallet ON access_grants(payer_wallet);
CREATE INDEX idx_payments_paywall ON payments(paywall_id);
```

---

## User Flows

### Flow 1: Creator Monetizes a Block

```
1. Creator logs in via "Login with Are.na" (OAuth)
2. Creator connects wallet (Coinbase Wallet / MetaMask)
3. Creator creates new block OR selects existing block
4. Creator toggles "Monetize this block"
5. Creator enters price (e.g., $0.05 USDC)
6. System stores paywall config in our database
7. Block now appears blurred to others
```

### Flow 2: Human Pays to View Block

```
1. Visitor browses channel, sees blurred block
2. Overlay shows: "🔒 $0.05 USDC to unlock"
3. Visitor clicks "Pay to unlock"
4. If not connected: wallet connection modal
5. Visitor confirms transaction in wallet
6. Payment settles on Base
7. Access grant stored in database
8. Content reveals (unblurs)
9. Future visits: content remains unlocked
```

### Flow 3: AI Agent Pays via API

```
1. Agent: GET /v2/blocks/12345

2. Proxy checks: Is block paywalled? Has agent paid?

3. If unpaid, return:
   HTTP/1.1 402 Payment Required
   X-Payment: {
     "scheme": "exact",
     "network": "base",
     "maxAmountRequired": "10000",  // $0.01 in USDC units
     "resource": "/v2/blocks/12345",
     "payTo": "0xCreatorWalletAddress",
     "maxTimeoutSeconds": 300
   }

4. Agent signs payment payload with private key

5. Agent retries:
   GET /v2/blocks/12345
   X-Payment-Response: <base64-encoded-signed-payment>

6. Proxy verifies signature via x402 facilitator

7. Proxy settles payment on-chain

8. Proxy returns block content:
   HTTP/1.1 200 OK
   X-Payment-Receipt: <settlement-confirmation>

   { "id": 12345, "content": "...", ... }
```

---

## x402 Integration Details

### Payment Required Response (402)

When a paywalled block is requested without payment:

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
X-Payment: eyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJiYXNlIi4uLn0=

{
  "error": "Payment required",
  "message": "This block requires payment to access",
  "price": "0.05",
  "currency": "USDC",
  "network": "base"
}
```

### X-Payment Header (decoded)

```json
{
  "scheme": "exact",
  "network": "base",
  "maxAmountRequired": "50000",
  "resource": "/v2/blocks/12345",
  "payTo": "0x1234567890abcdef1234567890abcdef12345678",
  "maxTimeoutSeconds": 300,
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "extra": {
    "blockId": 12345,
    "name": "Block Title"
  }
}
```

### Payment Flow

```
┌────────┐         ┌─────────┐         ┌────────────┐         ┌──────────┐
│ Client │         │  Proxy  │         │ Facilitator│         │   Base   │
└───┬────┘         └────┬────┘         └─────┬──────┘         └────┬─────┘
    │                   │                    │                     │
    │ GET /blocks/123   │                    │                     │
    │──────────────────>│                    │                     │
    │                   │                    │                     │
    │ 402 + X-Payment   │                    │                     │
    │<──────────────────│                    │                     │
    │                   │                    │                     │
    │ Sign payment      │                    │                     │
    │─────────┐         │                    │                     │
    │<────────┘         │                    │                     │
    │                   │                    │                     │
    │ GET + X-Payment-Response              │                     │
    │──────────────────>│                    │                     │
    │                   │                    │                     │
    │                   │ Verify signature   │                     │
    │                   │───────────────────>│                     │
    │                   │                    │                     │
    │                   │ Valid              │                     │
    │                   │<───────────────────│                     │
    │                   │                    │                     │
    │                   │ Settle payment     │                     │
    │                   │───────────────────────────────────────-->│
    │                   │                    │                     │
    │                   │                    │      Tx confirmed   │
    │                   │<─────────────────────────────────────────│
    │                   │                    │                     │
    │ 200 + content     │                    │                     │
    │<──────────────────│                    │                     │
    │                   │                    │                     │
```

---

## Authentication Flow

### OAuth with Are.na

```
┌────────┐         ┌─────────┐         ┌─────────┐
│ Browser│         │  Proxy  │         │ Are.na  │
└───┬────┘         └────┬────┘         └────┬────┘
    │                   │                   │
    │ Click "Login"     │                   │
    │──────────────────>│                   │
    │                   │                   │
    │ Redirect to Are.na OAuth              │
    │<──────────────────│                   │
    │                   │                   │
    │ Authorize app     │                   │
    │──────────────────────────────────────>│
    │                   │                   │
    │ Redirect with code│                   │
    │<──────────────────────────────────────│
    │                   │                   │
    │ /auth/callback?code=xxx               │
    │──────────────────>│                   │
    │                   │                   │
    │                   │ Exchange code     │
    │                   │──────────────────>│
    │                   │                   │
    │                   │ access_token      │
    │                   │<──────────────────│
    │                   │                   │
    │                   │ GET /v2/me        │
    │                   │──────────────────>│
    │                   │                   │
    │                   │ User profile      │
    │                   │<──────────────────│
    │                   │                   │
    │ Set session cookie│                   │
    │<──────────────────│                   │
    │                   │                   │
```

### Session Management

- After OAuth, issue JWT stored in httpOnly cookie
- JWT contains: `{ userId, arenaUserId, walletAddress }`
- Token expiry: 7 days (refresh on activity)

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | TypeScript, React (forked ervell) |
| **Backend** | Node.js 20+, Express, TypeScript |
| **Database** | PostgreSQL 15+ |
| **ORM** | Drizzle ORM |
| **Blockchain** | Base (Coinbase L2) |
| **Token** | USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) |
| **Payments** | x402 protocol |
| **Wallet SDK** | Coinbase Wallet SDK, ethers.js v6 |
| **Auth** | OAuth 2.0 with Are.na, JWT sessions |

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Visibility** | Blurred preview | Users see content exists, enticing them to pay |
| **Minimum price** | $0.01 USDC | Enables true micro-payments |
| **Scope (v1)** | Block-level only | Keep v1 simple, channel-level in v2 |
| **Network** | Base | Low fees, Coinbase ecosystem, native x402 support |
| **Pricing model** | Per-block | Clear value exchange per content piece |
| **Auth** | OAuth + wallet | Leverage existing Are.na identity |

---

## Project Structure

```
arena402/
├── packages/
│   └── api/                      # x402 Proxy API
│       ├── src/
│       │   ├── index.ts          # Express app entry
│       │   ├── config.ts         # Environment config
│       │   ├── middleware/
│       │   │   ├── x402.ts       # x402 payment verification & settlement
│       │   │   └── auth.ts       # JWT/session auth
│       │   ├── routes/
│       │   │   ├── arena.ts      # Proxied Are.na endpoints with x402
│       │   │   ├── auth.ts       # OAuth endpoints
│       │   │   ├── paywall.ts    # Paywall config endpoints
│       │   │   └── user.ts       # User profile/wallet
│       │   ├── services/
│       │   │   ├── arena.ts      # Are.na API client
│       │   │   ├── paywall.ts    # Paywall business logic
│       │   │   ├── payment.ts    # Payment recording & USDC conversion
│       │   │   ├── accessGrant.ts # Access grant management
│       │   │   └── user.ts       # User management
│       │   └── db/
│       │       ├── index.ts      # Database connection
│       │       └── schema.ts     # Drizzle schema (users, paywalls, payments, accessGrants)
│       ├── drizzle/              # SQL migrations
│       ├── package.json
│       └── tsconfig.json
│
├── scripts/
│   ├── test-x402.ts              # Quick 402 response test
│   └── test-x402-payment.ts      # Full payment flow test with wallet
│
├── docker-compose.yml            # PostgreSQL for dev
├── package.json                  # Workspace root
├── pnpm-workspace.yaml
├── spec.md                       # This specification
├── README.md                     # Quick start guide
├── todo-milestone*.md            # Milestone tracking
└── .env.example                  # Environment template
```

---

## Implementation Phases

### Phase 1: Core Backend Infrastructure ✅
- [x] Initialize monorepo with pnpm workspaces
- [x] Set up Express server with TypeScript
- [x] Configure PostgreSQL with Drizzle ORM
- [x] Implement database schema and migrations
- [x] Create basic Are.na API proxy (passthrough)

### Phase 2: Authentication ✅
- [x] Implement OAuth flow with Are.na
- [x] JWT session management
- [x] User profile storage
- [x] Wallet address linking endpoint

### Phase 3: Paywall Logic ✅
- [x] Paywall configuration endpoints
- [x] Block access checking
- [x] Access grant storage
- [x] Proxy enhancement to check paywalls

### Phase 4: x402 Payment Integration ✅
- [x] x402 middleware for 402 responses
- [x] Payment signature verification via facilitator
- [x] Integration with x402 facilitator (HTTPFacilitatorClient)
- [x] On-chain settlement on Base via facilitator
- [x] Payment and access grant recording
- [x] Dynamic per-block pricing (custom middleware)

### Phase 5: Frontend (Pending)
- [ ] Fork ervell repository
- [ ] Add paywall toggle to block creation
- [ ] Implement blurred preview component
- [ ] Payment modal with wallet connection
- [ ] User settings page for wallet/earnings

---

## Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgres://arena402:arena402@localhost:5432/arena402

# Are.na OAuth
ARENA_CLIENT_ID=your_client_id
ARENA_CLIENT_SECRET=your_client_secret
ARENA_REDIRECT_URI=http://localhost:3000/auth/arena/callback

# JWT
JWT_SECRET=your_jwt_secret_min_32_chars_long

# x402 / Base
FACILITATOR_URL=https://x402.org/facilitator
BASE_RPC_URL=https://mainnet.base.org
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Network: eip155:8453 for Base mainnet, eip155:84532 for Base Sepolia testnet
BASE_NETWORK_ID=eip155:8453
```

---

## API Reference

### Authentication

#### `GET /auth/arena`
Initiates OAuth flow with Are.na.

**Response:** Redirects to Are.na authorization page

#### `GET /auth/arena/callback`
OAuth callback handler.

**Query Parameters:**
- `code` - Authorization code from Are.na

**Response:** Sets session cookie, redirects to app

#### `POST /auth/logout`
Clears session.

**Response:** `200 OK`

---

### User

#### `GET /user/profile`
Get current user profile.

**Response:**
```json
{
  "id": "uuid",
  "arenaUserId": 12345,
  "arenaUsername": "username",
  "arenaSlug": "username",
  "walletAddress": "0x...",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### `PUT /user/wallet`
Update wallet address.

**Request:**
```json
{
  "walletAddress": "0x1234..."
}
```

**Response:**
```json
{
  "success": true,
  "walletAddress": "0x1234..."
}
```

#### `GET /user/earnings`
Get earnings summary and payment history.

**Response:**
```json
{
  "totalEarnings": "12.50",
  "currency": "USDC",
  "payments": [
    {
      "id": "uuid",
      "blockId": 12345,
      "amount": "0.05",
      "payerWallet": "0x...",
      "settledAt": "2024-01-01T00:00:00Z",
      "txHash": "0x..."
    }
  ]
}
```

---

### Paywall

#### `POST /paywall/configure`
Set or update paywall on a block.

**Request:**
```json
{
  "blockId": 12345,
  "priceUsdc": "0.05",
  "recipientWallet": "0x..."  // optional, defaults to user's wallet
}
```

**Response:**
```json
{
  "id": "uuid",
  "blockId": 12345,
  "priceUsdc": "0.05",
  "recipientWallet": "0x...",
  "active": true
}
```

#### `GET /paywall/:blockId`
Get paywall configuration for a block.

**Response:**
```json
{
  "id": "uuid",
  "blockId": 12345,
  "priceUsdc": "0.05",
  "recipientWallet": "0x...",
  "active": true,
  "ownerUsername": "creator"
}
```

#### `DELETE /paywall/:blockId`
Remove paywall from a block.

**Response:** `204 No Content`

---

### Are.na Proxy

All Are.na API endpoints are proxied with paywall enforcement:

#### `GET /v2/channels/:slug`
Returns channel with paywall metadata on blocks.

#### `GET /v2/channels/:slug/contents`
Returns channel contents with paywall metadata.

#### `GET /v2/blocks/:id`
Returns block content if paid, 402 if not.

**402 Response:**
```json
{
  "error": "Payment required",
  "price": "0.05",
  "currency": "USDC",
  "network": "base"
}
```

With header: `X-Payment: <base64-encoded-payment-requirements>`

---

## Security Considerations

1. **OAuth tokens** - Encrypted at rest in database
2. **JWT secrets** - Strong random secrets, rotated periodically
3. **Wallet validation** - Verify wallet address format before storing
4. **Payment verification** - Always verify through facilitator before granting access
5. **Rate limiting** - Prevent abuse of proxy endpoints
6. **CORS** - Restrict to known frontend origins
7. **Input validation** - Sanitize all user inputs
8. **SQL injection** - Use parameterized queries (Drizzle ORM)

---


