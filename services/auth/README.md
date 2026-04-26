# Auth Service

Identity, sessions, and OAuth microservice for the platform.

## Features
- Email/Password Registration and Login
- Secure Session Management with `httpOnly` and `sameSite` cookies
- Zod integration for request/response validation
- Fastify microservice architecture
- Argon2 password hashing

## Endpoints
- `POST /auth/register` - Create a new user account
- `POST /auth/login` - Authenticate and create a session
- `POST /auth/logout` - Destroy a session
- `GET /auth/me` - Validate the current session cookie and return the user profile

## Development
Run in dev mode using:
```bash
pnpm dev
```

Build for production:
```bash
pnpm build
```

Run tests:
```bash
pnpm dlx vitest run
```
