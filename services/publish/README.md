# @pcp/publish-service

Fastify v4 service that hosts user-published apps (static, Vite, Node) by
running them as Docker containers behind Traefik. Port **3006**, routes under
`/api`.

## Routes

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/hosted-services` | Create a hosted service from a workspace path. |
| `GET` | `/api/hosted-services` | List for the current user. |
| `GET` | `/api/hosted-services/:id` | Detail. |
| `POST` | `/api/hosted-services/:id/start` | Start container. |
| `POST` | `/api/hosted-services/:id/stop` | Stop container. |
| `PATCH` | `/api/hosted-services/:id` | Update env vars / autoRestart. |
| `DELETE` | `/api/hosted-services/:id` | Stop and remove. |
| `GET` | `/api/hosted-services/:id/logs` | Tail container logs. |

The `hosted_services.status` machine is documented in
[docs/DATA_MODEL.md](../../docs/DATA_MODEL.md).

## Traefik routing

Containers are launched with Traefik labels so traffic to
`<slug>.<HOSTING_DOMAIN>` is proxied to the right container. The local
compose file (`infra/docker/docker-compose.yml`) brings Traefik up at
:80/:443. In production each tenant is given a path-prefixed or
subdomain-scoped router; details in
[docs/PRODUCTION.md](../../docs/PRODUCTION.md).

## Encrypted env vars

`hosted_services.envVars` is a JSON map where every value is the literal
string `enc:<iv>.<tag>.<ciphertext>` (all base64). The publish service
encrypts on write and decrypts in-memory before injecting into the
container's environment.

The 32-byte symmetric key comes from `ENCRYPTION_KEY`.
**Production refuses to start** when:

- the variable is missing,
- it is shorter than 32 bytes,
- or it contains development markers (`dev-`, `change_me`).

To migrate plaintext rows from earlier development snapshots, run:

```bash
node scripts/encrypt-envvars.mjs
```

## Sandbox defaults

Hosted containers are launched with the same hardening profile as the
runtime service: dropped capabilities, `no-new-privileges`, read-only
rootfs, tmpfs `/tmp`, memory and CPU caps. `auto_restart=true` services
are revived when the engine reports `crashed`.

## Environment

| Variable | Purpose |
| --- | --- |
| `ENCRYPTION_KEY` | 32-byte utf-8 key (required in production). |
| `HOSTING_DOMAIN` | Base domain for Traefik routers. |
| `DOCKER_HOST` | Optional override. |
| `DATABASE_URL` | Drizzle. |
| `INTERNAL_SERVICE_TOKEN` | Cross-service auth. |
| `AUTH_SERVICE_URL` | Cookie session validation. |

## Scripts

```bash
pnpm --filter @pcp/publish-service dev
pnpm --filter @pcp/publish-service build
pnpm --filter @pcp/publish-service test
pnpm --filter @pcp/publish-service typecheck
```
