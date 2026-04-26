# Architectural Decisions Log

Format: ADR (Architectural Decision Record) lite.

---

## ADR-001: Monorepo with pnpm workspaces

**Date:** 2026-04-26  
**Status:** Accepted

**Context:** Multiple services share types and utilities.

**Decision:** Use pnpm workspaces in a monorepo.

**Consequences:**
- + Shared code easy
- + Atomic commits across services
- + Single dependency tree
- − Build complexity
- − CI must understand workspaces

---

## ADR-002: Drizzle ORM over Prisma

**Date:** 2026-04-26  
**Status:** Accepted

**Context:** Need type-safe DB access.

**Decision:** Drizzle for SQL-first approach.

**Consequences:**
- + Lighter, faster
- + Closer to SQL
- + Better TS inference
- − Less mature ecosystem
- − Manual migration writing

---

## ADR-003: Docker for MVP sandbox, microVM for V2

**Date:** 2026-04-26  
**Status:** Accepted

**Context:** Need isolated code execution.

**Decision:** Start with hardened Docker, abstract for Firecracker later.

**Consequences:**
- + Faster MVP
- + Familiar tooling
- − Weaker isolation than microVM
- − Migration effort later

---

## ADR-004: pgvector over dedicated vector DB

**Date:** 2026-04-26  
**Status:** Accepted

**Context:** Need semantic search for memory.

**Decision:** pgvector in PostgreSQL.

**Consequences:**
- + Single DB to manage
- + Joins with relational data
- + Lower ops overhead
- − May not scale to 100M+ vectors
- − Slower than specialized DBs

---

## ADR-005: MCP-compatible tool layer

**Date:** 2026-04-26  
**Status:** Accepted

**Context:** Tool standardization for agent.

**Decision:** Build tools to be MCP-compatible from day one.

**Consequences:**
- + Standard protocol
- + Future-proof
- + Easier integration
- − Slightly more upfront design

---

## Pending Decisions

- [ ] Auth: custom vs Clerk/Auth0
- [ ] Workflow durability: custom vs Temporal
- [ ] LLM provider primary: OpenAI vs Anthropic
- [ ] Frontend realtime: WS vs SSE for agent
- [ ] Storage: MinIO local vs direct S3