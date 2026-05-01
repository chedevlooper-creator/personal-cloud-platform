## Why

Published apps should run from the same workspace files that users edit through the
workspace service. The current publish service mounts `/tmp/workspaces/<user>/<workspace>`
but the publish path does not clearly materialize the S3-backed workspace into that host
directory before starting a hosted container, so hosting can start with missing or stale files.

## What Changes

- Add a deterministic workspace materialization step before starting a hosted service container.
- Reuse the workspace service sync-manifest contract instead of giving publish direct DB or S3 ownership.
- Ensure materialization is tenant-scoped by authenticated `userId` and `workspaceId`.
- Fail hosted service startup with a visible `crashed` status and log entry when workspace materialization fails.
- Add tests that prove publish starts containers only after materialization and does not use unscoped workspace paths.

## Capabilities

### New Capabilities
- `publish-workspace-source`: Published services receive a current, tenant-scoped workspace source tree before container startup.

### Modified Capabilities
- None.

## Impact

- Affected service code: `services/publish/src/service.ts`, likely a new publish workspace client/helper, and publish tests.
- Affected service contract: existing internal workspace sync-manifest endpoint is used by publish with the shared internal service token and `x-user-id`.
- Affected configuration: publish needs workspace service URL and internal service token configuration if not already available.
- No frontend API shape change is expected; failures should surface through existing hosted service status/logs.
