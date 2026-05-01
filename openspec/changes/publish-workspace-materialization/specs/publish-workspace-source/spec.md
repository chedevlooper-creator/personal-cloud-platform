## ADDED Requirements

### Requirement: Hosted service startup materializes workspace source
The publish service SHALL materialize the hosted service workspace source tree
from the workspace service before creating or starting the hosted Docker
container.

#### Scenario: Start uses current workspace source
- **WHEN** a user starts a hosted service for a workspace they own
- **THEN** the publish service fetches that workspace's sync manifest as the acting user
- **AND** the hosted container is created only after the manifest has been written to the tenant workspace host directory

#### Scenario: Materialization removes stale files
- **WHEN** a workspace file was deleted or renamed before hosted service startup
- **THEN** the published workspace host directory does not retain the old file from a previous startup

### Requirement: Materialization preserves tenant isolation
The publish service SHALL write workspace source files only under the resolved
host directory for the authenticated user and workspace.

#### Scenario: Unsafe manifest path is rejected
- **WHEN** the workspace sync manifest contains a path that would escape the tenant workspace directory
- **THEN** publish marks the hosted service startup as failed
- **AND** no hosted Docker container is started for that request

#### Scenario: Internal workspace fetch is scoped
- **WHEN** publish fetches the sync manifest for a hosted service
- **THEN** the request includes the internal service bearer token and the hosted service user id
- **AND** workspace service ownership checks determine whether the manifest is returned

### Requirement: Startup fails closed on incomplete source
The publish service SHALL fail hosted service startup instead of launching a
container with missing, empty, or partially materialized source files.

#### Scenario: Missing file content blocks startup
- **WHEN** a non-directory manifest entry has no inline content available
- **THEN** publish records the hosted service as crashed with a log entry explaining materialization failed
- **AND** publish does not create or start the hosted container

#### Scenario: Workspace service failure blocks startup
- **WHEN** the workspace service rejects or fails the sync-manifest request
- **THEN** publish records the hosted service as crashed with the failure reason
- **AND** publish does not create or start the hosted container
