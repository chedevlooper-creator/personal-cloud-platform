# Quick Task 260501-chat: Global Chat Workspace Context

## Goal

Fix global chat being unusable on non-workspace pages such as `/terminal`.

## Evidence

- All required dev services are listening on ports 3000-3004.
- Browser reproduction on `/terminal` shows the global chat panel is visible, but `ChatCore` disables input when `workspaceId` is `null`.
- `WorkspaceShell` sets `activeWorkspaceId`, but top-level pages do not.

## Plan

1. Let `GlobalChatPanel` resolve the first available workspace when no active workspace is set.
2. Preserve selected conversation context by setting `activeWorkspaceId` from conversation rows on `/chats`.
3. Handle the follow-on provider configuration failure surfaced after the workspace fix.
4. Verify typecheck/lint, targeted tests, and browser behavior.

## UI/UX Checks

- Keep disabled state semantic while workspace context is loading.
- Preserve existing touch targets, icon labels, and keyboard behavior.
- Avoid visual layout churn in the fixed chat panel.

## Findings During Execution

- The original `/terminal` chat failure was caused by `workspaceId=null`; the composer was disabled outside workspace pages.
- After the composer was enabled, task creation succeeded but agent execution failed because the local MiniMax provider has no API key configured.
- Very fast task failures could race the frontend SSE subscription, leaving the new conversation stuck with only the user message until a manual refresh.

## Verification

- `corepack pnpm --filter web lint`
- `corepack pnpm --filter web typecheck`
- `corepack pnpm --filter @pcp/agent-service typecheck`
- `corepack pnpm --filter @pcp/auth-service typecheck`
- `corepack pnpm --filter @pcp/agent-service exec vitest run src/orchestrator.test.ts`
- `corepack pnpm --filter @pcp/auth-service exec vitest run src/__tests__/provider-credentials.test.ts`
- Playwright `/terminal` flow: chat input enabled, `GET /api/workspaces` returned 200, `POST /api/agent/tasks` returned 201, and missing-provider-key failure renders as a readable chat message instead of a raw provider 401.
