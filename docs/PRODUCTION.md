# Production Deployment Guide — CloudMind OS

## Overview

This document covers deploying CloudMind OS to a production environment. The platform is designed as a set of independent microservices behind a Traefik reverse proxy, with PostgreSQL, Redis, and MinIO as supporting infrastructure.

## Architecture

```
Internet → Traefik (HTTPS) → {auth, workspace, runtime, agent, memory, publish, browser} → PostgreSQL + Redis + MinIO
                            → Next.js (SSR/static)
```

## Pre-Production Checklist

### 1. Secrets & Encryption

- [ ] Generate a cryptographically secure `ENCRYPTION_KEY` (exactly 32 bytes, must not start with `dev-` and must not contain `change_me`):
  ```bash
  # 32 random bytes, base64-encoded (decode at runtime if you need raw 32 bytes):
  openssl rand -base64 32
  # Or 32 raw bytes hex-encoded (then take the first 32 chars as utf-8 string):
  node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"  # 32 base64 chars
  ```
- [ ] Generate strong `COOKIE_SECRET`:
  ```bash
  openssl rand -base64 32
  ```
- [ ] Set unique `POSTGRES_PASSWORD` (not the dev default)
- [ ] Set unique `MINIO_ROOT_PASSWORD`
- [ ] Configure `ADMIN_EMAIL` to restrict admin panel access

### 2. HTTPS / TLS

Traefik supports automatic Let's Encrypt:

```yaml
# Add to traefik command in docker-compose.yml
- "--certificatesresolvers.letsencrypt.acme.email=admin@yourdomain.com"
- "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
- "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
- "--entrypoints.websecure.address=:443"
```

### 3. Database

- Use managed PostgreSQL (e.g., AWS RDS, Supabase, Neon) for automated backups
- Enable SSL connections: add `?sslmode=require` to `DATABASE_URL`
- Run migrations before starting services:
  ```bash
  DATABASE_URL=... pnpm --filter @pcp/db migrate
  ```

### 4. Object Storage

- MinIO can be replaced with any S3-compatible service (AWS S3, Cloudflare R2, etc.)
- Set `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` accordingly
- Enable bucket versioning for snapshot durability

### 5. Redis

- Use managed Redis (e.g., AWS ElastiCache, Upstash) for high availability
- Enable persistence (AOF) for BullMQ job durability
- Set `REDIS_URL` with authentication

## Docker Compose (Production)

For a single-server deployment, extend the existing `docker-compose.yml`:

```yaml
# docker-compose.prod.yml
services:
  auth:
    build:
      context: ../..
      dockerfile: services/auth/Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - COOKIE_SECRET=${COOKIE_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    restart: always
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.auth.rule=Host(`api.yourdomain.com`) && PathPrefix(`/auth`)"
      - "traefik.http.services.auth.loadbalancer.server.port=3001"

  # Repeat similar pattern for workspace, runtime, agent, publish...

  web:
    build:
      context: ../..
      dockerfile: apps/web/Dockerfile
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_AUTH_API_URL=https://api.yourdomain.com/auth
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web.rule=Host(`yourdomain.com`)"
      - "traefik.http.services.web.loadbalancer.server.port=3000"
```

## Monitoring

### Logging
All services use Pino JSON logging. In production, pipe to a log aggregator:
- **Datadog**, **Grafana Loki**, or **AWS CloudWatch**
- Key fields: `correlationId`, `userId`, `service`, `level`

### Health Checks
Each service exposes `GET /health`:
- Auth: `:3001/health`
- Workspace: `:3002/health`
- Runtime: `:3003/health`
- Agent: `:3004/health`
- Memory: `:3005/health`
- Publish: `:3006/health`
- Browser: `:3007/health`

Use these for load balancer health probes and uptime monitors.

### Audit Logs
The `audit_logs` table records all security-relevant events:
- Login/logout/register
- API key add/revoke
- Preference changes

Access via Admin panel or direct DB query.

## Scaling

### Horizontal Scaling
- **Stateless services** (auth, workspace, agent, publish) can be scaled horizontally behind Traefik
- **Runtime service** is stateful (WebSocket PTY sessions) — use sticky sessions or a single instance per user
- **BullMQ workers** (agent service) can be scaled — Redis handles job distribution

### Database
- Use read replicas for query-heavy services (workspace file listing, conversation history)
- Connection pooling via PgBouncer for high concurrency

## Backup Strategy

| Component | Method | Frequency |
|-----------|--------|-----------|
| PostgreSQL | `pg_dump` or managed backups | Daily |
| MinIO / S3 | Bucket versioning + cross-region replication | Continuous |
| Redis | AOF persistence + snapshots | Hourly |

For self-hosted single-user installs the repo ships:

- `scripts/backup.sh <BACKUP_ROOT>` — `pg_dump -F c` + `mc mirror` of the MinIO bucket. Honors `BACKUP_RETENTION_DAYS` (default 14) and optional `BACKUP_REMOTE_S3_TARGET` for offsite mirroring. Read its env requirements at the top of the file before scheduling.
- `scripts/restore.sh <BACKUP_ROOT>/<TIMESTAMP>` — `pg_restore` + bucket re-mirror. Requires `RESTORE_CONFIRM=yes` because it drops the database first.

Suggested cron entry (nightly at 03:30 UTC, persisted to `/var/backups/pcp`):

```cron
30 3 * * * /opt/pcp/scripts/backup.sh /var/backups/pcp >> /var/log/pcp-backup.log 2>&1
```

## Audit Log

Every privileged action emits an `audit_logs` row (`user_id`, `action`, `details` JSON). Coverage today: auth login/logout/preference updates, BYOK credential add/revoke, tool execution (auto + approved), snapshot restore/delete, channel link create/delete, hosted-service create/update/start/stop/delete. Browse via `GET /admin/audit-logs` (auth-service admin route) or query directly:

```sql
SELECT created_at, action, details
FROM audit_logs
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 100;
```

### Retention

Audit rows accumulate forever by default. Use `scripts/prune-audit-logs.mjs` to drop entries older than `AUDIT_RETENTION_DAYS` (default 90):

```cron
0 4 * * * cd /opt/pcp && DATABASE_URL=... AUDIT_RETENTION_DAYS=90 node scripts/prune-audit-logs.mjs >> /var/log/pcp-audit-prune.log 2>&1
```

Pass `--dry` to preview the count without deleting.

## Hosted-service envVars at rest

`hosted_services.env_vars` values are encrypted with AES-256-GCM (`enc:<iv>.<tag>.<ciphertext>`) before they reach Postgres. The publish service decrypts only when launching a container. Client-facing API responses replace each value with `***`. Set `ENCRYPTION_KEY` (32 bytes) in the publish service environment to enable; in production this is required and the service refuses to start without it.

## Security Hardening

- [ ] Set `secure: true` on session cookies (requires HTTPS)
- [ ] Configure CORS `origin` to your exact domain (not `true`)
- [ ] Set `sameSite: 'strict'` on cookies in production
- [ ] Rotate `ENCRYPTION_KEY` periodically (implement key versioning — already supported via `keyVersion` column)
- [ ] Enable PostgreSQL row-level security for defense-in-depth
- [ ] Run containers as non-root users
- [ ] Scan Docker images with Trivy or Snyk
