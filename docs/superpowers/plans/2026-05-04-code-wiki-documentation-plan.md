# Code Wiki Documentation Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `docs/CODE_WIKI.md` GitHub-friendly and easier to maintain by converting IDE-only links to repo-relative links, tightening structure, and adding explicit maintenance rules.

**Architecture:** Keep `CODE_WIKI.md` as a single authoritative “code navigation” doc; link to existing docs for deeper ops/product content; ensure all references are repo-relative and verifiable via file-path checks.

**Tech Stack:** Markdown, git, basic CLI checks (`git diff`, `rg`/`grep` equivalent via `git` + `pnpm` not required).

---

### Task 1: Convert `file:///workspace/...` links to repo-relative links

**Files:**
- Modify: `docs/CODE_WIKI.md`

- [ ] **Step 1: Find all IDE-only links**

Run:

```bash
git --no-pager grep -n "file:///workspace" -- docs/CODE_WIKI.md
```

Expected: One or more matches.

- [ ] **Step 2: Choose a consistent link format**

Use links relative to `docs/CODE_WIKI.md`:

- Files in repo root: `../README.md`, `../package.json`
- Files under `services/`: `../services/<svc>/src/index.ts`
- Files under `packages/`: `../packages/<pkg>/src/...`
- Files under `infra/`: `../infra/docker/...`
- Files inside `docs/`: `AGENT.md`, `DATA_MODEL.md`, etc.

- [ ] **Step 3: Apply link conversions**

Edit `docs/CODE_WIKI.md` to replace patterns like:

- `file:///workspace/docs/AGENT.md` → `AGENT.md`
- `file:///workspace/README.md#L116-L160` → `../README.md#L116-L160`
- `file:///workspace/services/auth/src/index.ts` → `../services/auth/src/index.ts`
- `file:///workspace/packages/shared/src/errors.ts#L91-L108` → `../packages/shared/src/errors.ts#L91-L108`

- [ ] **Step 4: Re-check for leftover IDE-only links**

Run:

```bash
git --no-pager grep -n "file:///workspace" -- docs/CODE_WIKI.md || true
```

Expected: No output.

---

### Task 2: Restructure `CODE_WIKI.md` for “code navigation” clarity

**Files:**
- Modify: `docs/CODE_WIKI.md`

- [ ] **Step 1: Add an explicit “Purpose” section near the top**

Insert a short section directly after the title that answers:

- What this doc is (code navigation / architecture map)
- What it is not (not a production runbook; not a full spec)
- Where to go for ops/product deep dives (link to `docs/PRODUCTION.md`, `docs/DECISIONS.md`, etc.)

- [ ] **Step 2: Normalize section ordering to match the design**

Ensure the main headings follow this order (titles can match exactly):

1. Purpose (new)
2. Repository Layout
3. Architecture
4. Shared Packages
5. Backend Services
6. Frontend (Next.js Web App)
7. Dependency Relationships
8. Running Locally (keep brief and point to README for full steps)
9. Testing
10. Keeping This Document Up To Date (new, see Task 3)

- [ ] **Step 3: Make each service section consistent**

For each service under “Backend Services”, ensure the same fields appear in the same order:

- Location
- Entrypoint
- Responsibilities
- Key class(es) and 2–4 bullet callouts of important methods/behaviors
- Related policy/security modules (when relevant)

- [ ] **Step 4: Validate the result reads cleanly**

Run:

```bash
git --no-pager diff -- docs/CODE_WIKI.md | head -n 120
```

Expected: A coherent, mostly link/structure-focused diff.

---

### Task 3: Add “Keeping This Document Up To Date” rules

**Files:**
- Modify: `docs/CODE_WIKI.md`

- [ ] **Step 1: Add a new section at the end**

Add a section titled:

```markdown
## Keeping This Document Up To Date
```

- [ ] **Step 2: Add concrete update triggers**

Include a concise bullet list of triggers (no vague guidance), such as:

- When a new service is added under `services/`, add it to “Backend Services” with entrypoint + main class.
- When service ports or URL prefixes change, update the service header or routing notes.
- When a service’s entrypoint file moves/renames, update the entrypoint link.
- When infra scripts/paths change (`infra/docker`, `scripts/`), update the “Repository Layout” and “Running Locally” references.

- [ ] **Step 3: Add a “definition of done” checklist**

Add 3–5 checkboxes maintainers can follow (e.g., “no `file:///workspace` links”, “at least one entrypoint link per service”, etc.).

---

### Task 4: Verification pass (no code changes)

**Files:**
- Verify: `docs/CODE_WIKI.md`

- [ ] **Step 1: Ensure all referenced local paths exist**

For each link you changed to a local file path, verify quickly:

```bash
git --no-pager grep -oE "\\([^)]*\\)" -- docs/CODE_WIKI.md | head -n 50
```

Manually spot-check a representative sample and ensure the target files exist in the repo:

- `../services/*/src/index.ts`
- `../packages/*/...`
- `../infra/docker/docker-compose.yml`

- [ ] **Step 2: Ensure there are no absolute-workspace links**

Run:

```bash
git --no-pager grep -n "file:///workspace" -- docs/CODE_WIKI.md || true
```

Expected: No output.

- [ ] **Step 3: Ensure the merge diff remains documentation-only**

Run:

```bash
git --no-pager status
```

Expected: Only `docs/CODE_WIKI.md` modified (plus any plan/spec docs if included in the same branch).

---

### Optional: Commit workflow (only if you intend to commit)

- [ ] **Step 1: Review the final diff**

```bash
git --no-pager diff
```

- [ ] **Step 2: Commit**

```bash
git add docs/CODE_WIKI.md
git commit -m "docs: make CODE_WIKI GitHub-friendly and add maintenance rules"
```

