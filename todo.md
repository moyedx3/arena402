# Arena402 - Implementation Progress

## Overview

Building a monetization layer for Are.na using x402 payments on Base network (USDC).

See [spec.md](./spec.md) for full technical specification.

---

## Milestones

| # | Milestone | Status | Details |
|---|-----------|--------|---------|
| 1 | Core Backend Infrastructure | ✅ Complete | [todo-milestone1.md](./todo-milestone1.md) |
| 2 | Authentication | ✅ Complete | [todo-milestone2.md](./todo-milestone2.md) |
| 3 | Paywall Logic | ✅ Complete | [todo-milestone3.md](./todo-milestone3.md) |
| 4 | x402 Payment Integration | ⏳ Pending | - |
| 5 | Frontend (ervell fork) | ⏳ Pending | - |

---

## Quick Reference

### Current Focus: Milestone 4 - x402 Payment Integration

- Install x402 packages (@x402/express, @x402/core, @x402/evm)
- x402 middleware for 402 responses with payment headers
- Payment signature verification via facilitator
- On-chain settlement on Base
- Record payments and grant access

### Commands

```bash
# Development
pnpm dev              # Start API server
pnpm db:studio        # Open Drizzle Studio

# Database
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations

# Docker
docker-compose up -d  # Start PostgreSQL
docker-compose down   # Stop PostgreSQL
```

---

## Completed Work

### Milestone 3 (2026-01-04)
- Paywall service (create, read, update, delete paywalls)
- Access grant service (check and record who paid for what)
- Paywall configuration endpoints (/paywall/*)
- Enhanced proxy with `_paywall` metadata injection
- Block access checking with 402 responses
- Wallet extraction from header, query, or JWT

### Milestone 2 (2026-01-04)
- Are.na OAuth flow (login with Are.na)
- JWT session management (httpOnly cookies)
- User storage in PostgreSQL
- Wallet address linking endpoints
- Protected route middleware

### Milestone 1 (2026-01-04)
- pnpm monorepo structure
- Express server with TypeScript
- PostgreSQL + Drizzle ORM schema
- Are.na API proxy (channels, blocks)
- Health check endpoint
- ESLint configuration
