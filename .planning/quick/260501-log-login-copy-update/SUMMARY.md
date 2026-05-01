---
status: complete
quick_id: 260501-log
slug: login-copy-update
date: 2026-05-01
---

# Summary

Updated the `/login` auth surface per browser diff comment.

## Completed

- Changed the login page heading from `Tekrar hoş geldiniz` to `Login`.
- Changed the idle submit button label from `Giriş yap` to `Login`.
- Preserved existing layout, form labels, loading copy, and auth behavior.

## Verification

- `pnpm --filter web lint` passed.
- `pnpm --filter web typecheck` passed.
- `http://localhost:3000/login` returned HTTP 200 and included `Login`.
