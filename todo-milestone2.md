# Milestone 2: Authentication

## Status: ✅ Complete

**Started:** 2026-01-04
**Completed:** 2026-01-04

---

## Overview

Implement user authentication via Are.na OAuth, JWT session management, and wallet address linking. Users will be able to log in with their Are.na account and connect a wallet for receiving payments.

**Goal:** Users can authenticate with Are.na, have persistent sessions, and link their wallet address for future paywall earnings.

---

## Tasks

### 1. Are.na OAuth Setup

- [x] Register OAuth application at dev.are.na (manual step - user action)
- [x] Add OAuth environment variables to config.ts
- [x] Create `src/routes/auth.ts` with OAuth endpoints
- [x] Implement `GET /auth/arena` - redirect to Are.na authorization
- [x] Implement `GET /auth/arena/callback` - handle OAuth callback
- [x] Exchange authorization code for access token
- [x] Fetch user profile from Are.na (`GET /v2/me`)

### 2. User Storage

- [x] Create `src/services/user.ts` - user management service
- [x] Implement `findOrCreateUser(arenaUser)` - upsert user from OAuth
- [x] Implement `getUserById(id)` - fetch user by UUID
- [x] Implement `getUserByArenaId(arenaUserId)` - fetch by Are.na ID
- [ ] Store encrypted access token (deferred - storing plain for now)

### 3. JWT Session Management

- [x] Install jsonwebtoken package
- [x] Create `src/middleware/auth.ts` - JWT middleware
- [x] Implement `generateToken(user)` - create JWT with user data
- [x] Implement `verifyToken(token)` - validate and decode JWT
- [x] Set JWT in httpOnly cookie on successful OAuth
- [x] Create `requireAuth` middleware for protected routes
- [x] Implement `GET /auth/me` - get current session user
- [x] Implement `POST /auth/logout` - clear session cookie

### 4. Wallet Address Linking

- [x] Create `src/routes/user.ts` - user profile routes
- [x] Implement `GET /user/profile` - get current user profile
- [x] Implement `PUT /user/wallet` - update wallet address
- [x] Add wallet address validation (Ethereum address format)
- [x] Implement `updateWalletAddress(userId, address)` in user service
- [x] Implement `DELETE /user/wallet` - remove wallet address (bonus)

### 5. Testing & Integration

- [x] Test OAuth flow end-to-end (requires valid OAuth credentials)
- [x] Test JWT token generation and validation
- [x] Test protected route access with valid/invalid tokens
- [ ] Test wallet address update endpoint
- [x] Update main index.ts to mount auth and user routes

---

## API Endpoints (Milestone 2)

| Endpoint | Method | Auth | Description | Status |
|----------|--------|------|-------------|--------|
| `/auth/arena` | GET | No | Redirect to Are.na OAuth | ✅ |
| `/auth/arena/callback` | GET | No | OAuth callback handler | ✅ |
| `/auth/me` | GET | Yes | Get current session user | ✅ |
| `/auth/logout` | POST | Yes | Clear session | ✅ |
| `/user/profile` | GET | Yes | Get user profile | ✅ |
| `/user/wallet` | PUT | Yes | Update wallet address | ✅ |
| `/user/wallet` | DELETE | Yes | Remove wallet address | ✅ |

---

## Environment Variables (New)

```bash
# Are.na OAuth (required for Milestone 2)
ARENA_CLIENT_ID=your_client_id
ARENA_CLIENT_SECRET=your_client_secret
ARENA_REDIRECT_URI=https://your-ngrok-url.ngrok-free.dev/auth/arena/callback

# JWT
JWT_SECRET=your_jwt_secret_min_32_chars_long
```

**Note:** Are.na requires HTTPS for redirect URIs. Use ngrok for local development.

---

## New Dependencies

```bash
pnpm --filter @arena402/api add jsonwebtoken cookie-parser
pnpm --filter @arena402/api add -D @types/jsonwebtoken @types/cookie-parser
```

---

## File Structure (New/Modified)

```
packages/api/
├── src/
│   ├── index.ts              # ✅ Mount new routes, add cookie-parser
│   ├── config.ts             # ✅ Load .env from project root
│   ├── middleware/
│   │   └── auth.ts           # ✅ NEW: JWT verification middleware
│   ├── routes/
│   │   ├── arena.ts          # Existing proxy routes
│   │   ├── auth.ts           # ✅ NEW: OAuth endpoints
│   │   └── user.ts           # ✅ NEW: User profile endpoints
│   └── services/
│       ├── arena.ts          # Existing Are.na client (added getMe)
│       └── user.ts           # ✅ NEW: User management
```

---

## OAuth Flow Diagram

```
┌────────┐         ┌─────────┐         ┌─────────┐
│ Browser│         │  Proxy  │         │ Are.na  │
└───┬────┘         └────┬────┘         └────┬────┘
    │                   │                   │
    │ GET /auth/arena   │                   │
    │──────────────────>│                   │
    │                   │                   │
    │ 302 Redirect      │                   │
    │<──────────────────│                   │
    │                   │                   │
    │ Authorize at Are.na                   │
    │──────────────────────────────────────>│
    │                   │                   │
    │ 302 Redirect with code                │
    │<──────────────────────────────────────│
    │                   │                   │
    │ GET /auth/arena/callback?code=xxx     │
    │──────────────────>│                   │
    │                   │                   │
    │                   │ POST /oauth/token │
    │                   │──────────────────>│
    │                   │                   │
    │                   │ { access_token }  │
    │                   │<──────────────────│
    │                   │                   │
    │                   │ GET /v2/me        │
    │                   │──────────────────>│
    │                   │                   │
    │                   │ { user profile }  │
    │                   │<──────────────────│
    │                   │                   │
    │ Set-Cookie: token │                   │
    │<──────────────────│                   │
    │                   │                   │
```

---

## Verification Checklist

- [x] `GET /auth/arena` redirects to Are.na OAuth page
- [x] OAuth callback creates/updates user in database
- [x] JWT cookie is set after successful OAuth
- [x] `GET /auth/me` returns current user when authenticated
- [x] `GET /auth/me` returns 401 when not authenticated
- [x] `POST /auth/logout` clears session cookie
- [x] `GET /user/profile` returns user with wallet address
- [x] `PUT /user/wallet` updates wallet address
- [x] Invalid wallet addresses are rejected

---

## Tested OAuth Flow

Successfully authenticated user:
```json
{
  "success": true,
  "user": {
    "id": "a21ccfdb-e71a-4e23-88f1-dfbc27912faf",
    "arenaUserId": 599657,
    "arenaUsername": "Ethan Eun",
    "arenaSlug": "ethan-eun",
    "walletAddress": null
  }
}
```

---

## Notes

### Are.na OAuth Registration

To register an OAuth app with Are.na:
1. Go to https://dev.are.na/oauth/applications
2. Create new application
3. Set redirect URI to your ngrok HTTPS URL (e.g., `https://xxx.ngrok-free.dev/auth/arena/callback`)
4. Copy Client ID and Client Secret to `.env`

### JWT Token Contents

```json
{
  "userId": "uuid",
  "arenaUserId": 12345,
  "arenaUsername": "username",
  "walletAddress": "0x..." | null,
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Security Considerations

- [x] Use httpOnly cookies for JWT (prevents XSS)
- [x] Validate wallet address format before storing
- [ ] Store access tokens encrypted in database (deferred)
- [ ] Set appropriate CORS headers for frontend (Milestone 5)

### Config Fix

The `.env` file is at project root, but the API runs from `packages/api/`. Fixed by updating `config.ts` to resolve the path:

```typescript
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
```

---

## Next: Milestone 3 - Paywall Logic

After completing authentication:

1. Paywall configuration endpoints
2. Block access checking
3. Access grant storage
4. Proxy enhancement to check paywalls
