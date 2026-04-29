# Phase 3 Verification: Runtime And Publish Sandbox Hardening

**Verdict:** PASS with unrelated frontend lint debt.
**Verified:** 2026-04-29

## Requirement Coverage

| Requirement | Result  | Evidence                                                                                                                                                                                                     |
| ----------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SBOX-01     | PASS    | Runtime and publish containers are non-root, read-only, capability-dropped, no-new-privileges, tmpfs-backed, pid-limited, CPU/RAM-limited, and swap-capped with regression tests.                            |
| SBOX-02     | PASS    | Runtime and publish image allow-lists are enforced, and optional seccomp/AppArmor profile names are wired into Docker `SecurityOpt` through validated env config.                                            |
| SBOX-03     | PASS    | Agent `run_command` exposes approval, timeout, network, output, and blocked-category policy metadata; runtime command policy blocks destructive root deletion, privilege escalation, and fork-bomb patterns. |
| SBOX-04     | PASS    | Publish env vars are encrypted before persistence, masked in service responses, decrypted for Docker launch only, and filtered by safe env names.                                                            |
| TST-01      | PARTIAL | Phase 3 has regression coverage for sandbox and secret contracts; web/shared baseline coverage remains future Phase 5 work.                                                                                  |

## Verification Commands

- `pnpm --filter @pcp/runtime-service test` passed.
- `pnpm --filter @pcp/publish-service test` passed.
- `pnpm --filter @pcp/agent-service test` passed.
- `pnpm test` passed.
- `pnpm typecheck` passed.
- `git diff --check` passed.

## Known Non-Blocking Debt

- `pnpm lint` is still blocked by existing frontend React lint errors in
  `apps/web`; these are not caused by Phase 3 runtime/publish code.
- Docker remains the MVP isolation boundary. Stronger isolation providers such
  as Firecracker, Kata, or gVisor remain tracked as v2 requirement VM-01.
- Deployment must provision any configured seccomp/AppArmor profile files or
  names on Docker hosts before enabling the corresponding env vars.
