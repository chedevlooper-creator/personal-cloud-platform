# Phase 2 Research: Tenant Isolation And Audit Hardening

## Existing Protections

- Workspace file object keys already use a helper shaped like
  `workspaces/{userId}/{workspaceId}/...`.
- Workspace ownership checks exist in core workspace create/get/restore paths.
- Runtime service validates workspace ownership before creating runtimes and
  scopes runtime lookup by `runtimeId` plus `userId`.
- Publish service scopes list/update/start/stop/delete operations by `userId`
  before running lifecycle side effects.
- Agent personas and skills are user-scoped in their route/service surfaces.
- Phase 1 introduced a shared session helper that can be reused instead of
  duplicating DB session reads.

## Gaps Found

### DB Resource Scoping

- Some mutations rely on a prior scoped read but update by resource id only.
  Examples include runtime status/delete/event/log updates, publish status/crash
  updates, dataset delete, and snapshot status updates.
- Agent channel task polling has an id-only task lookup in task completion
  waiting logic after resolving a channel link.
- These patterns are lower risk than unauthenticated raw access when the prior
  read is correct, but they are brittle: future call-site drift can remove the
  guard while leaving the mutation unsafe.

### Storage And Host Paths

- Normal workspace file keys include `userId`, `workspaceId`, and a normalized
  file path.
- Snapshot artifact keys use `snapshots/{workspaceId}/...`, which is not
  tenant-prefixed.
- Runtime host workspace paths use only `workspaceId` under `WORKSPACE_HOST_ROOT`.
- Publish workspace volume paths use `/tmp/workspaces/{workspaceId}` and should
  be tied to tenant ownership or a runtime storage contract.

### Container Metadata

- Runtime Docker defaults are already relatively strict: non-root user,
  disabled networking by default, read-only rootfs, dropped capabilities, pid
  limits, `no-new-privileges`, and tmpfs.
- Runtime containers do not currently carry tenant labels.
- Publish containers have Traefik labels but not application tenant labels such
  as `pcp.userId`, `pcp.workspaceId`, or `pcp.hostedServiceId`.

### Audit Logging

- Audit emitters exist in several services, but helpers are ad hoc and failure
  handling differs.
- Snapshot route audit failure currently uses `console.error`.
- Runtime command execution and destructive file operations need explicit safe
  audit coverage in touched flows.

## Implementation Guidance

- Add tenant predicates to final DB `where` clauses for sensitive writes and
  reads where the row already has enough ownership data.
- Where a table does not directly include `userId`, scope through workspace
  ownership before side effects and keep the ownership object close to the
  mutation.
- Prefer small helper functions for tenant-prefixed path construction so tests
  can assert path shape without a Docker daemon or S3 service.
- Add Docker labels in provider/service launch inputs and test config generation
  rather than requiring real containers.
- Keep audit details small, structured, and explicitly allow-listed.

## Verification Strategy

- Unit-test negative cross-tenant cases for representative DB operations.
- Unit-test storage key/host path helpers with path traversal attempts.
- Unit-test Docker config/label generation without Docker.
- Run service tests with `pnpm test`.
- Run `pnpm typecheck` after implementation plans.
