# Milestone 1: Core Backend Infrastructure

## Status: ✅ Complete (pending Docker setup)

**Completed:** 2026-01-04

---

## Overview

Set up the foundational backend infrastructure including monorepo structure, Express server, PostgreSQL database with Drizzle ORM, and a basic Are.na API proxy.

**Goal:** A working proxy server that can forward requests to Are.na API and return responses, with database ready for paywall data.

---

## Tasks

### 1. Initialize Monorepo Structure

- [x] Initialize pnpm workspace at root
- [x] Create `packages/api/` directory structure
- [x] Set up root `package.json` with workspace config
- [x] Create `pnpm-workspace.yaml`
- [x] Add `.gitignore` for node_modules, .env, dist, etc.

### 2. Set Up Express Server with TypeScript

- [x] Initialize `packages/api/package.json`
- [x] Install dependencies (express, typescript, tsx, dotenv)
- [x] Create `tsconfig.json` for api package
- [x] Create `src/index.ts` entry point with basic Express server
- [x] Create `src/config.ts` for environment variable handling
- [x] Add dev/build/start scripts to package.json
- [x] Verify server runs on `http://localhost:3000`

### 3. Configure PostgreSQL with Docker

- [x] Create `docker-compose.yml` with PostgreSQL 15
- [x] Define database name, user, password in compose file
- [x] Create `.env.example` with DATABASE_URL template
- [ ] Test database connection locally (requires Docker group access)

### 4. Set Up Drizzle ORM

- [x] Install drizzle-orm and drizzle-kit
- [x] Install postgres driver
- [x] Create `src/db/index.ts` for database connection
- [x] Create `src/db/schema.ts` with tables (users, paywalls, payments, access_grants)
- [x] Create `drizzle.config.ts`
- [ ] Generate initial migration (after Docker setup)
- [ ] Run migration against local database (after Docker setup)

### 5. Create Basic Are.na API Proxy

- [x] Create `src/services/arena.ts` - Are.na API client
- [x] Create `src/routes/arena.ts` - Proxy route handlers
- [x] Implement proxy for key endpoints:
  - `GET /v2/channels/:slug` ✅
  - `GET /v2/channels/:slug/contents` ✅
  - `GET /v2/blocks/:id` ✅
- [x] Add error handling for Are.na API failures
- [x] Test proxy with real Are.na API calls

### 6. Project Configuration & Quality

- [x] Add ESLint with TypeScript config
- [x] Create README.md with setup instructions
- [x] Add basic health check endpoint (`GET /health`)

---

## Verification Checklist

- [x] `pnpm install` works from root
- [x] `pnpm dev` starts server on port 3000
- [ ] `docker-compose up -d` starts PostgreSQL (requires: `sudo usermod -aG docker $USER`)
- [ ] Database has all 4 tables (after Docker setup)
- [x] `GET /health` returns 200
- [x] `GET /v2/channels/arena-influences` proxies to Are.na and returns data
- [x] `GET /v2/blocks/:id` proxies to Are.na and returns block data

---

## Remaining Setup (User Action Required)

To complete Docker/database setup:

```bash
# Add yourself to docker group
sudo usermod -aG docker $USER

# Log out and log back in (or run: newgrp docker)

# Start PostgreSQL
docker-compose up -d

# Run migrations
pnpm db:generate
pnpm db:migrate
```

---

## File Structure

```
arena402/
├── packages/
│   └── api/
│       ├── src/
│       │   ├── index.ts           # Express app entry
│       │   ├── config.ts          # Environment config
│       │   ├── db/
│       │   │   ├── index.ts       # Database connection
│       │   │   └── schema.ts      # Drizzle schema
│       │   ├── routes/
│       │   │   └── arena.ts       # Are.na proxy routes
│       │   ├── services/
│       │   │   └── arena.ts       # Are.na API client
│       │   └── middleware/        # (empty, for Phase 3+)
│       ├── drizzle.config.ts
│       ├── eslint.config.js
│       ├── package.json
│       └── tsconfig.json
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── .env.example
├── .gitignore
├── README.md
├── spec.md
└── todo.md
```

---

## Next: Milestone 2 - Authentication

After completing Docker setup, proceed to Milestone 2:

1. Implement OAuth flow with Are.na
2. JWT session management
3. User profile storage
4. Wallet address linking endpoint
