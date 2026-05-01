## 1. Configuration And Client

- [x] 1.1 Add publish env fields for `WORKSPACE_SERVICE_URL`, `INTERNAL_SERVICE_TOKEN`, and `PUBLISH_WORKSPACE_HOST_ROOT` with production-safe validation.
- [x] 1.2 Add a publish workspace client that fetches `/workspaces/:workspaceId/sync/manifest` using bearer internal token and `X-User-Id`.
- [x] 1.3 Add typed errors for workspace client failures so startup can record actionable hosted service logs.

## 2. Workspace Materialization

- [x] 2.1 Implement a publish materializer that resolves `<root>/<userId>/<workspaceId>` and refuses paths outside the configured root.
- [x] 2.2 Rebuild the workspace directory from the sync manifest before startup so stale files are removed.
- [x] 2.3 Decode manifest file `contentBase64` as bytes and fail if a non-directory file has missing content.
- [x] 2.4 Verify whether workspace sync manifest generation preserves binary bytes; update it if needed while keeping runtime compatibility.

## 3. Publish Startup Integration

- [x] 3.1 Call materialization before `docker.createContainer` in hosted service startup.
- [x] 3.2 Mount the materialized directory read-only into the hosted container.
- [x] 3.3 On materialization failure, mark the hosted service `crashed`, write a hosted service log line, and skip container creation.
- [x] 3.4 Replace publish `console.error` startup paths touched by this change with structured logger usage where available.

## 4. Verification

- [x] 4.1 Add publish unit tests proving startup fetches and materializes the workspace before Docker container creation.
- [x] 4.2 Add tests for stale file cleanup and unsafe manifest path rejection.
- [x] 4.3 Add tests for workspace service failure and missing file content failure paths.
- [x] 4.4 Run `pnpm --filter @pcp/publish-service test` and any impacted workspace/runtime tests.
