---
phase: 3
title: Runtime And Publish Sandbox Hardening
created: 2026-04-29
source: ROADMAP.md
---

# Phase 3 Context

## Goal

Workspace runtimes and hosted app containers run with stricter Docker
boundaries, resource limits, image policy, and tool policy visibility.

## Current State

- Runtime containers are created by `services/runtime/src/provider/docker.ts`.
- Publish containers are created directly in `services/publish/src/service.ts`.
- Both runtime and publish already use non-root users, resource limits,
  read-only root filesystems, dropped capabilities, `no-new-privileges`, tmpfs
  `/tmp`, and no direct Docker requirement in tests.
- Runtime uses `NetworkMode: none`; publish uses `pcp_network` for Traefik app
  routing.
- Runtime command execution blocks a few dangerous command patterns and times
  out after 60 seconds.
- Agent `run_command` requires approval, but the user-facing policy details are
  embedded in the tool description rather than shared structured metadata.

## Real Gaps

- Runtime and publish sandbox options are duplicated rather than centralized.
- No explicit image allow-list exists for runtime or publish launches.
- No hardened seccomp/AppArmor configuration path exists.
- Runtime exec policy is not reusable or well surfaced to the agent/tool layer.
- Hosted-service secret handling has tests for env filtering/masking, but needs
  a final regression pass after sandbox changes.

## Constraints

- Do not require Docker, Postgres, Redis, or MinIO for tests.
- Keep Docker as the MVP boundary; do not start a microVM migration.
- Preserve publish networking through Traefik.
- Preserve runtime workspace write semantics; hosted app workspace mounts remain
  read-only.
- Keep env secrets encrypted at rest and masked in API-facing responses.
