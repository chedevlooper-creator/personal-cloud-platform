## Context

The publish service starts Docker containers for hosted services and mounts a
tenant-specific host path as `/workspace`. Today that path is derived as
`/tmp/workspaces/<userId>/<workspaceId>`, but publish does not own the canonical
workspace storage and does not currently have a clear source sync step before
container startup.

The workspace service already exposes an internal sync-manifest endpoint at
`/api/workspaces/:id/sync/manifest`. The runtime service uses the same contract to
materialize workspace files before command execution. Publish should follow that
service boundary instead of reading workspace DB rows or S3 objects directly.

## Goals / Non-Goals

**Goals:**
- Materialize the authenticated user's current workspace tree before each hosted
  service container start.
- Keep publish independent from direct workspace storage ownership.
- Prevent stale files from surviving after deletes or renames.
- Preserve tenant isolation in the host directory layout and internal service call.
- Make startup failures visible through hosted service status and logs.
- Cover the behavior with focused publish service tests.

**Non-Goals:**
- No frontend API contract changes.
- No new database tables or migrations.
- No direct S3/MinIO access from publish.
- No broad refactor of runtime workspace sync.

## Decisions

1. **Use the workspace sync-manifest endpoint as the source of truth.**

   Publish will call `WORKSPACE_SERVICE_URL/workspaces/:workspaceId/sync/manifest`
   with `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>` and `X-User-Id:
   <service.userId>`. This preserves the existing service boundary and lets the
   workspace service enforce workspace ownership.

   Alternative considered: import workspace DB schema and storage code directly
   into publish. Rejected because it violates package ownership and duplicates
   tenant/storage logic.

2. **Add a publish-local workspace client/materializer.**

   A small helper in `services/publish/src` should mirror the runtime client shape
   but remain publish-owned for now. It will fetch the manifest, validate paths,
   and write files under a configured host root.

   Alternative considered: move the runtime workspace client to a shared package.
   Rejected for this change because sharing the client would expand scope and
   couple two services before the publish bug is fixed.

3. **Use a configurable publish workspace root.**

   Add `WORKSPACE_SERVICE_URL`, `INTERNAL_SERVICE_TOKEN`, and
   `PUBLISH_WORKSPACE_HOST_ROOT` to publish env. Default the host root to
   `/tmp/workspaces` to preserve current behavior, but route all path creation
   through one helper that resolves `<root>/<userId>/<workspaceId>`.

4. **Materialize before Docker create/start and fail closed.**

   `startService()` should fetch and materialize the workspace before
   `docker.createContainer`. If materialization fails, update the hosted service
   to `crashed`, write a hosted service log entry, and do not start a container.

   Manifest entries with unsafe paths or missing file content must fail the
   startup rather than creating empty files silently. If the current manifest size
   limit is too low for publish, publish should request a higher bounded
   `maxInlineBytes` and tests should cover the failure path for omitted content.

5. **Clear stale source before writing fresh source.**

   Materialization should rebuild the tenant workspace directory from the manifest
   so files deleted in the workspace service are not still present in hosted
   containers. Implement with a staging directory and swap when practical, or a
   carefully scoped delete/recreate of the resolved tenant directory.

## Risks / Trade-offs

- **Large workspace manifests increase memory and network use.** -> Keep
  `maxInlineBytes` bounded and fail with a clear log if the workspace cannot be
  represented by the manifest.
- **Binary assets can be corrupted if the manifest encodes text rather than raw
  bytes.** -> Treat `contentBase64` as raw bytes during materialization and adjust
  workspace manifest generation if implementation confirms it currently uses text
  decoding for binary files.
- **Deleting the wrong host path would be severe.** -> Resolve absolute paths and
  assert the final target is inside the configured publish root before any cleanup.
- **Publish and runtime now have similar materialization code.** -> Accept the
  short-term duplication; extract a shared helper later if both paths stabilize.

## Migration Plan

1. Add publish env parsing for workspace service URL, internal service token, and
   workspace host root.
2. Add publish workspace client/materializer and unit tests.
3. Wire `PublishService.startService()` / container startup through materialization.
4. Keep existing hosted service rows valid; no migration is needed.
5. Rollback by disabling the new materializer call and returning to the old host
   path mount behavior.

## Open Questions

- What maximum publish workspace size should be allowed for initial MVP
  materialization?
- Should large/binary file support be moved from sync manifest to a streaming
  internal file export endpoint in a later change?
