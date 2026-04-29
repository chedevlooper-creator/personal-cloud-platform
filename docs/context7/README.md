# Context7 Documentation Cheatsheets

CloudMind OS projesinde kullanılan tüm major teknolojiler için Context7'den çekilmiş, geliştirme amaçlı cheatsheet'ler. Her dosya, projeyle alakalı (servisler, frontend, sandbox, RAG, queue, vs.) odaklı kod örnekleri içerir.

| Dosya | Kütüphane | Projedeki Yer |
|---|---|---|
| [nextjs.md](nextjs.md) | Next.js 16 | `apps/web` |
| [react.md](react.md) | React 19 | `apps/web/src` |
| [fastify.md](fastify.md) | Fastify 4 | `services/*` |
| [drizzle.md](drizzle.md) | Drizzle ORM | `packages/db` |
| [bullmq.md](bullmq.md) | BullMQ | `services/agent/automation` |
| [tailwind.md](tailwind.md) | Tailwind CSS v4 | `apps/web` |
| [zod.md](zod.md) | Zod | `packages/shared`, route validation |
| [tanstack-query.md](tanstack-query.md) | TanStack Query | `apps/web` |
| [zustand.md](zustand.md) | Zustand | `apps/web/src/store` |
| [dockerode.md](dockerode.md) | Dockerode | `services/runtime`, `services/publish` |
| [pgvector.md](pgvector.md) | pgvector + pgvector-node | `services/memory` |
| [anthropic.md](anthropic.md) | Anthropic SDK | `services/agent/llm` |
| [openai.md](openai.md) | OpenAI SDK | `services/agent/llm`, embeddings |
| [vitest.md](vitest.md) | Vitest | service test'leri |
| [xterm.md](xterm.md) | xterm.js | `apps/web` terminal UI |
| [monaco.md](monaco.md) | Monaco Editor | `apps/web` editor |
| [traefik.md](traefik.md) | Traefik 3 | `infra/docker`, hosting |
| [minio.md](minio.md) | MinIO / S3 policy | object storage, tenant isolation |
| [argon2.md](argon2.md) | argon2 | `services/auth` |
| [shadcn.md](shadcn.md) | shadcn/ui | `apps/web/src/components/ui` |

## Notlar
- Snippet'ler Context7 üzerinden çekildi (resmi repo kaynakları).
- Hepsi proje invariant'larına (tenant scoping, layered service, no cross-service DB) dikkat ederek seçildi.
- Bir libary'nin tüm API'si yoktur; ihtiyaç oldukça `mcp_io_github_ups_get-library-docs` ile yeni topic çekin.
