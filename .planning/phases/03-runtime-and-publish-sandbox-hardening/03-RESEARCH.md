---
phase: 3
title: Runtime And Publish Sandbox Hardening Research
created: 2026-04-29
---

# Phase 3 Research

## Code Findings

- `DockerProvider.create()` already sets core HostConfig limits:
  `Memory`, `NanoCpus`, `NetworkMode: none`, `ReadonlyRootfs`, `CapDrop:
['ALL']`, `PidsLimit`, `SecurityOpt: ['no-new-privileges:true']`, tmpfs `/tmp`,
  and `nofile` ulimit.
- `PublishService.runContainer()` duplicates a similar HostConfig while keeping
  `NetworkMode: pcp_network` and a read-only workspace bind.
- Runtime tests mock `dockerode` and inspect `createContainer` options, making
  sandbox changes cheap to verify.
- Publish tests also mock `dockerode` and inspect hosted container config.
- Agent `RunCommandTool` can expose policy in its tool definition without
  requiring runtime service changes.

## Implementation Direction

- Introduce a small shared sandbox helper under `services/runtime/src/provider`
  for runtime Docker host config construction.
- Mirror the same policy constants in publish if sharing across packages would
  introduce an awkward dependency; avoid cross-service imports.
- Add explicit `Privileged: false`, `Init: true`, `MemorySwap` equal to memory,
  and `OomKillDisable: false` to reduce ambiguity in container launch config.
- Add optional `securityOpt`/profile support through env or provider options in
  03-02 rather than hardcoding host-specific profile names in 03-01.
- Add allow-list validation as a service-level policy so rejected images never
  reach Docker.

## Test Strategy

- Keep tests at config-object level; do not launch containers.
- RED tests should assert new hardening fields before implementation.
- Use existing Vitest patterns and `dockerode` mocks.
- Keep policy tests focused; avoid a broad fixture framework.
