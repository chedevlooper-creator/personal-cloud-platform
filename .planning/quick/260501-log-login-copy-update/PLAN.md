---
status: in-progress
quick_id: 260501-log
slug: login-copy-update
date: 2026-05-01
---

# Login Copy Update

Address browser diff comment on `/login`: show "Login" copy on the selected login surface.

## Scope

- Update only the login page copy requested by the browser comment.
- Preserve the existing auth layout, token usage, form labels, and API behavior.

## Verification

- `pnpm --filter web lint`
- `pnpm --filter web typecheck`
- Confirm `/login` renders with the updated copy from the running dev server.
