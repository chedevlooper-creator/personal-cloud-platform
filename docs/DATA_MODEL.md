# Data Model

Source of truth: [packages/db/src/schema](../packages/db/src/schema). All tables live in
the single Drizzle schema; services never own their own migrations.

## Tenancy rule

Every row is scoped to a `user_id` (and often a `workspace_id`). Every query in
every service **must** filter by these columns. S3 keys and Docker container
labels are tenant-prefixed for the same reason.

## Entity map

```
users ──┬── sessions
        ├── oauth_accounts
        ├── audit_logs
        ├── notifications
        ├── integrations
        ├── provider_credentials      (BYOK, AES-256-GCM)
        ├── user_preferences          (defaultProvider, defaultModel, rules, theme)
        ├── personas                  (per-user system prompts)
        ├── skills                    (SKILL.md-style capability injections)
        ├── channel_links             (telegram/email/discord ↔ user)
        ├── datasets                  (DuckDB-backed tabular files)
        ├── memory_entries            (pgvector 1536-dim embeddings)
        │
        └── workspaces ──┬── workspace_files
                         ├── runtimes ──┬── runtime_logs
                         │              └── runtime_events
                         ├── terminal_sessions ── terminal_commands
                         ├── snapshots
                         ├── hosted_services ── hosted_service_logs
                         ├── automations ── automation_runs
                         └── conversations ──┬── tasks ──┬── task_steps
                                             │           ├── tool_calls
                                             │           └── approval_requests
                                             └── (web | telegram | email | discord)
```

## Tables (cheatsheet)

### Identity & access
| Table | Key columns | Purpose |
| --- | --- | --- |
| `users` | `id`, `email`, `password_hash` | Account record. `password_hash` nullable for OAuth-only users. |
| `sessions` | `id` (token), `user_id`, `expires_at` | HTTP-only cookie session. |
| `oauth_accounts` | `user_id`, `provider`, `provider_account_id` | Linked OAuth identities (Google). |
| `audit_logs` | `user_id`, `action`, `details`, `ip_address` | Privileged-action history. |

### Personalization
| Table | Notes |
| --- | --- |
| `user_preferences` | `defaultProvider`, `defaultModel`, `rules` (free text injected into system prompt), `terminalRiskLevel` (`strict`/`normal`/`permissive`), `notificationPrefs`. |
| `provider_credentials` | BYOK API keys. `encryptedKey` is AES-256-GCM with `iv` + `authTag`; plaintext never stored. Soft-revoke via `revokedAt`. |
| `personas` | Per-user prompt presets. Exactly one `isDefault=true` is selected when no persona is passed. |
| `skills` | Capability blocks. `bodyMarkdown` is concatenated into the system prompt when the skill id is selected. May mirror a `<workspace>/Skills/<slug>/SKILL.md` file. |

### Workspace & files
| Table | Notes |
| --- | --- |
| `workspaces` | Per-user storage container. `storageUsed`/`storageLimit` are bytes. Soft-deleted via `deletedAt`. |
| `workspace_files` | Metadata. File bytes live in MinIO/S3 under `storageKey`. `isDirectory='1'` for folders. |
| `snapshots` | tar.gz copies of a workspace pinned to `storageKey`. `kind`: `manual` or `auto-pre-restore`. |
| `datasets` | Tabular files registered into a per-user DuckDB. `tableName` is the DuckDB target. |

### Execution
| Table | Notes |
| --- | --- |
| `runtimes` | One Docker container per workspace. `status`: `pending`/`running`/`stopped`/`error`. `options` carries cpu/memory/env. |
| `runtime_logs`, `runtime_events` | stdout/stderr lines and lifecycle events. |
| `terminal_sessions`, `terminal_commands` | xterm.js PTY sessions. `policy`: `safe`/`needs_approval`/`blocked`. |
| `hosted_services` | Static / Vite / Node apps deployed by the publish service. `status`: `stopped`/`starting`/`running`/`crashed`/`stopping`. `envVars` are AES-256-GCM encrypted per value. |

### Conversations & agent
| Table | Notes |
| --- | --- |
| `conversations` | Chat thread. `channel`: `web`/`telegram`/`email`/`discord`. `personaId` and `model` carry forward to tasks. |
| `tasks` | One agent run. `status`: `pending`→`planning`→`executing`→(`waiting_approval`)→`completed`/`failed`/`cancelled`. `metadata.personaId` and `metadata.skillIds` drive the system prompt. |
| `task_steps` | Human-readable execution log. `type`: `thought`/`action`/`observation`. |
| `tool_calls` | Structured tool invocations. `status`: `pending`/`awaiting_approval`/`running`/`completed`/`failed`/`rejected`/`timeout`. |
| `approval_requests` | Pending-approval queue for risky tools. `decision`: `approve`/`reject`/`expired`. |

### Memory
| Table | Notes |
| --- | --- |
| `memory_entries` | pgvector `vector(1536)` embeddings. `type`: `short-term`/`long-term`/`episodic`. Cosine search via raw SQL. |

### Automations & channels
| Table | Notes |
| --- | --- |
| `automations` | BullMQ-driven scheduled prompts. `scheduleType`: `manual`/`hourly`/`daily`/`weekly`/`cron`. `notificationMode`: `none`/`in-app`/`email-mock`/`webhook`. |
| `automation_runs` | One row per execution. `trigger`: `manual`/`schedule`/`tool`/`webhook`. Links to `tasks.id`. |
| `channel_links` | Maps `(channel, externalId)` → `userId`. Inbound Telegram/email routes through this. |

### Notifications & integrations
| Table | Notes |
| --- | --- |
| `notifications` | In-app inbox. `kind`: `automation_run`/`approval_required`/`service_crashed`/`snapshot_ready`/`system`. |
| `integrations` | Outbound integrations (Gmail mock, Notion mock, generic webhook). `encryptedSecret` mirrors the BYOK pattern. |

## Encryption

`provider_credentials.encryptedKey`, `integrations.encryptedSecret`, and each
value of `hosted_services.envVars` are AES-256-GCM ciphertext written by the
auth/publish services. The 32-byte symmetric key is shared via `ENCRYPTION_KEY`.
Production refuses to start when the key is missing, shorter than 32 bytes, or
contains development markers (`dev-`, `change_me`).

## State machines

### `tasks.status`
```
pending → planning → executing → completed
                  ↘ waiting_approval ↗
                                 ↘ failed
                                 ↘ cancelled
```

### `tool_calls.status`
```
pending → running → completed
       ↘ awaiting_approval → running → completed
                          ↘ rejected
                          ↘ timeout
       ↘ failed
```

### `hosted_services.status`
```
stopped → starting → running ↻
                  ↘ crashed → starting (auto_restart=true)
running → stopping → stopped
```
