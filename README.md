# Personal Cloud Workspace + AI Agent Platform

A multi-tenant cloud platform providing persistent workspaces, code execution sandboxes, and AI agent orchestration.

## Documentation

- [Build Plan](./docs/BUILD_PLAN.md) — full development roadmap
- [Decisions](./docs/DECISIONS.md) — architectural decisions log
- [Progress](./docs/PROGRESS.md) — current status
- [API](./docs/API.md) — API reference

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### Local Development

```bash
# Clone and install
git clone <repo>
cd personal-cloud-platform
pnpm install

# Setup environment
cp infra/docker/.env.example infra/docker/.env
# Edit .env with your values

# Start infrastructure
cd infra/docker
docker compose up -d

# Wait for services to be healthy
docker compose ps

# Run migrations
cd ../..
pnpm --filter @pcp/db migrate

# Start services (in separate terminals)
pnpm --filter @pcp/auth dev
pnpm --filter @pcp/api dev
pnpm --filter @pcp/web dev
```

### Access
- Web: http://localhost:3000
- API: http://localhost:4000
- Traefik dashboard: http://localhost:8080
- MinIO console: http://localhost:9001
- Mailhog UI: http://localhost:8025

## Project Structure
```text
.
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS gateway
├── services/         # Backend services
├── packages/         # Shared packages
├── infra/            # Docker, migrations
├── .cursor/rules/    # Cursor AI rules
└── docs/             # Documentation
```

## Development with Cursor
This project is designed for Cursor AI-assisted development. See `.cursor/rules/` for module-specific guidance.

When starting any task, reference:

- `@docs/BUILD_PLAN.md`
- `@.cursor/rules/architecture.mdc`
- `@.cursor/rules/<module>.mdc`

## License
TBD