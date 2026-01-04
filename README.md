# Arena402

Monetize Are.na content via x402 payments on Base network (USDC).

## Overview

Arena402 enables Are.na users to set prices on individual blocks. Both human visitors and AI agents can pay to access paywalled content.

- **Humans**: See blurred previews, pay via wallet to unlock
- **AI Agents**: Receive HTTP 402 with x402 headers, sign payment, access content

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

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Server runs at `http://localhost:3000`

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /v2/channels/:slug` | Get channel info (proxied from Are.na) |
| `GET /v2/channels/:slug/contents` | Get channel contents |
| `GET /v2/blocks/:id` | Get block content (402 if paywalled) |

## Project Structure

```
arena402/
├── packages/
│   └── api/                 # Express API server
│       ├── src/
│       │   ├── index.ts     # Entry point
│       │   ├── config.ts    # Environment config
│       │   ├── db/          # Drizzle ORM schema
│       │   ├── routes/      # API routes
│       │   └── services/    # Business logic
│       └── drizzle/         # Migrations
├── docker-compose.yml       # PostgreSQL
├── spec.md                  # Full specification
└── todo.md                  # Implementation progress
```

## Development

```bash
# Run dev server with hot reload
pnpm dev

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
- **Payments**: x402 protocol

## License

MIT
