# Auth Service

Identity, sessions, OAuth, BYOK provider keys, audit log, and admin gate. Port `3001`.

## Features
- Email + password registration and login (Argon2id hashing).
- HTTP-only `SameSite=Lax` session cookies.
- Google OAuth 2.1 with PKCE.
- Per-route rate limiting (`@fastify/rate-limit`).
- AES-256-GCM encryption for user-supplied provider API keys (BYOK).
- Audit log for privileged actions (login, key add/revoke, preference change).
- Admin gate via `ADMIN_EMAIL` env var.

## Endpoints

### Sessions
- `POST /auth/register` — create account, start session
- `POST /auth/login` — credential login
- `POST /auth/logout` — destroy current session
- `GET  /auth/me` — return current user

### OAuth
- `GET /auth/oauth/google/start`
- `GET /auth/oauth/google/callback`

### Profile / preferences
- `GET  /user/profile`
- `PATCH /user/profile`
- `GET  /user/preferences`
- `PATCH /user/preferences`

### Provider credentials (BYOK)
- `GET    /user/providers`
- `POST   /user/providers`     — encrypted server-side; plaintext never stored or logged
- `DELETE /user/providers/:id` — soft-revoke

### Admin
- `GET /admin/users`
- `GET /admin/audit-logs`

## Environment

Required:
- `DATABASE_URL`
- `COOKIE_SECRET` (≥32 bytes)
- `ENCRYPTION_KEY` (exactly 32 bytes, must not start with `dev-` and must not contain `change_me`)

Optional:
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `ADMIN_EMAIL`

## Scripts
```bash
pnpm dev        # tsx watch
pnpm build      # tsc
pnpm test       # vitest run
pnpm typecheck
```
