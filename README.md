# Arena402

Monetize Are.na content via x402 payments on Base network (USDC).

## Overview

Arena402 enables Are.na users to set prices on individual blocks. Both human visitors and AI agents can pay to access paywalled content.

- **Humans**: See blurred previews, pay via wallet to unlock
- **AI Agents**: Receive HTTP 402 with x402 headers, sign payment, access content

## Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Core Backend | ✅ Complete | Express, PostgreSQL, Drizzle, Are.na proxy |
| Phase 2: Authentication | ✅ Complete | OAuth with Are.na, JWT sessions |
| Phase 3: Paywall Logic | ✅ Complete | Paywall config, access grants, 402 responses |
| Phase 4: x402 Integration | ✅ Complete | Full x402 protocol with facilitator |
| Phase 5: Frontend | ⏳ Pending | Fork ervell, add paywall UI |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

### Setup

```bash
# Install dependencies
pnpm install

# Start PostgreSQL
docker-compose up -d

# Copy environment variables
cp .env.example .env
# Edit .env with your Are.na OAuth credentials

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Server runs at `http://localhost:3000`

## API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/arena` | GET | Start Are.na OAuth flow |
| `/auth/arena/callback` | GET | OAuth callback |
| `/auth/me` | GET | Get current user (requires auth) |
| `/auth/logout` | POST | Log out |

### User

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/user/profile` | GET | Get user profile |
| `/user/wallet` | PUT | Update wallet address |

### Paywall

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/paywall/configure` | POST | Create/update paywall on block |
| `/paywall/:blockId` | GET | Get paywall info |
| `/paywall/:blockId` | DELETE | Remove paywall |
| `/paywall` | GET | List my paywalls |

### Are.na Proxy (with x402)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/channels/:slug` | GET | Get channel (with paywall metadata) |
| `/v2/channels/:slug/contents` | GET | Get channel contents |
| `/v2/blocks/:id` | GET | Get block (**402 if paywalled**) |

## x402 Payment Flow

When requesting a paywalled block:

```
1. Client: GET /v2/blocks/12345

2. Server returns:
   HTTP/1.1 402 Payment Required
   X-Payment: <base64-encoded-payment-requirements>

   {
     "error": "Payment required",
     "paywall": {
       "blockId": 12345,
       "priceUsdc": "0.05",
       "recipientWallet": "0x..."
     }
   }

3. Client signs payment with wallet

4. Client retries:
   GET /v2/blocks/12345
   X-Payment: <signed-payment>

5. Server verifies via facilitator, settles on Base

6. Server returns:
   HTTP/1.1 200 OK
   X-Payment-Receipt: {"txHash": "0x...", ...}

   { block content }
```

## Testing

### Test 402 Response (No Wallet Needed)

```bash
# Quick test to verify 402 responses
npx tsx scripts/test-x402.ts <blockId>
```

### Test Full Payment Flow (Requires Testnet USDC)

```bash
# 1. Get testnet USDC from https://faucet.circle.com/ (Base Sepolia)

# 2. Set your test wallet private key
export TEST_PRIVATE_KEY="your_private_key"

# 3. Run the payment test
npx tsx scripts/test-x402-payment.ts <blockId>
```

## Project Structure

```
arena402/
├── packages/
│   └── api/                 # Express API server
│       ├── src/
│       │   ├── index.ts     # Entry point
│       │   ├── config.ts    # Environment config
│       │   ├── db/          # Drizzle ORM schema
│       │   ├── middleware/
│       │   │   ├── auth.ts  # JWT authentication
│       │   │   └── x402.ts  # x402 payment middleware
│       │   ├── routes/      # API routes
│       │   └── services/    # Business logic
│       └── drizzle/         # Migrations
├── scripts/
│   ├── test-x402.ts         # 402 response test
│   └── test-x402-payment.ts # Full payment test
├── docker-compose.yml       # PostgreSQL
├── spec.md                  # Full specification
└── todo-milestone*.md       # Implementation progress
```

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
BASE_NETWORK_ID=eip155:8453  # or eip155:84532 for testnet
```

## Development

```bash
# Run dev server with hot reload
pnpm dev

# Build for production
pnpm build

# Generate new migration after schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Open Drizzle Studio (DB GUI)
pnpm db:studio
```

## Tech Stack

- **Runtime**: Node.js 20+, Express, TypeScript
- **Database**: PostgreSQL 15, Drizzle ORM
- **Blockchain**: Base (Coinbase L2), USDC
- **Payments**: x402 protocol (@x402/core, @x402/evm)
- **Auth**: OAuth 2.0 with Are.na, JWT sessions

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@x402/core` | x402 protocol types, HTTPFacilitatorClient |
| `@x402/evm` | EVM payment scheme for Base |
| `@x402/express` | Express middleware utilities |
| `@x402/fetch` | Client-side payment wrapper |
| `viem` | Ethereum/Base wallet interactions |
| `drizzle-orm` | Type-safe database ORM |

## License

MIT
