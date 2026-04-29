---
phase: 3
plan: 03-03
subsystem: runtime sandbox
tags:
  - secret-handling
  - docker-profiles
  - tests
requires:
  - 03-01
  - 03-02
provides:
  - hosted-env-secret-regression-tests
  - docker-security-profile-config
  - runtime-command-policy-regression-tests
affects:
  - services/runtime/src/env.ts
  - services/runtime/src/policy.ts
  - services/runtime/src/policy.test.ts
  - services/runtime/src/provider/docker.ts
  - services/runtime/src/provider/docker.test.ts
  - services/publish/src/env.ts
  - services/publish/src/policy.ts
  - services/publish/src/policy.test.ts
  - services/publish/src/service.ts
  - services/publish/src/service.test.ts
key-files:
  created:
    - services/runtime/src/policy.test.ts
    - .planning/phases/03-runtime-and-publish-sandbox-hardening/03-VERIFICATION.md
  modified:
    - services/runtime/src/env.ts
    - services/runtime/src/policy.ts
    - services/runtime/src/provider/docker.ts
    - services/runtime/src/provider/docker.test.ts
    - services/publish/src/env.ts
    - services/publish/src/policy.ts
    - services/publish/src/policy.test.ts
    - services/publish/src/service.ts
    - services/publish/src/service.test.ts
key-decisions:
  - Keep Docker as the MVP boundary while wiring optional seccomp/AppArmor profile names through validated env config.
  - Reject `unconfined`, traversal, whitespace, and invalid Docker security profile values instead of passing them to Docker.
  - Test hosted env secret behavior at the service boundary where encryption, masking, and launch-time decryption meet.
requirements-completed:
  - SBOX-01
  - SBOX-02
  - SBOX-03
  - SBOX-04
  - TST-01
duration: 0.3h
completed: 2026-04-29
---

# Phase 3 Plan 03-03: Verify Hosted Secret Handling And Sandbox Regressions Summary

Phase 3 is now closed with regression coverage for hosted secrets, Docker
security profile wiring, and command policy edge cases.

## What Changed

- Added configurable Docker security profile wiring for runtime containers:
  - `RUNTIME_SECCOMP_PROFILE`
  - `RUNTIME_APPARMOR_PROFILE`
- Added matching publish container profile wiring:
  - `PUBLISH_SECCOMP_PROFILE`
  - `PUBLISH_APPARMOR_PROFILE`
- Runtime and publish policy modules now build Docker `SecurityOpt` arrays from
  validated profile config and always include `no-new-privileges:true`.
- Policy validation rejects unsafe profile values such as `unconfined`,
  traversal, whitespace, and malformed AppArmor names.
- Runtime command policy now blocks privilege escalation when `sudo` appears
  inside a shell-wrapper command such as `/bin/sh -c "sudo id"`.
- Publish service tests now prove hosted env vars are:
  - encrypted before DB insert/update
  - masked in service responses
  - decrypted only for Docker `Env`
  - filtered so invalid env names never reach Docker
- Runtime and publish launch tests now fail if configured seccomp/AppArmor
  profile wiring is removed.

## Verification

- RED confirmed:
  - Runtime policy tests failed before `buildRuntimeSecurityOptions` existed.
  - Runtime Docker launch test failed before configured profiles reached
    `HostConfig.SecurityOpt`.
  - Runtime command test exposed that shell-wrapped `sudo` was not blocked.
  - Publish policy tests failed before `buildPublishSecurityOptions` existed.
  - Publish launch test failed before configured profiles reached
    `HostConfig.SecurityOpt`.
- GREEN confirmed:
  - `pnpm --filter @pcp/runtime-service test` passed.
  - `pnpm --filter @pcp/publish-service test` passed.
  - `pnpm --filter @pcp/agent-service test` passed.
  - `pnpm test` passed.
  - `pnpm typecheck` passed.
  - `pnpm exec prettier --write` completed on touched files.
  - `git diff --check` passed.

## Deviations from Plan

- `pnpm lint` still fails on pre-existing `apps/web` React lint errors outside
  this sandbox plan:
  - `apps/web/src/app/(main)/rules/page.tsx`
  - `apps/web/src/components/automations/create-automation-dialog.tsx`
  - `apps/web/src/components/ui/theme-toggle.tsx`
- Existing dirty memory migration/service files were present during execution
  and were not staged or modified by this plan.

**Total deviations:** 2 known scope/verification deviations.
**Impact:** Phase 3 sandbox and secret-handling requirements are verified;
unrelated frontend lint and memory work remain separate.

## Next

Ready for Phase 4 planning/execution: agent durability, approval, telemetry, and
memory retrieval hardening.
