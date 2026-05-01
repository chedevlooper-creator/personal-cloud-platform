## Context

CloudMind OS currently maintains three separate chat surfaces:
1. **Dashboard Chat (`chat-home.tsx`)** — Uses `POST /agent/chat` with simulated token streaming; messages are ephemeral (lost on refresh)
2. **Chats Page (`chats/page.tsx`)** — Uses `POST /agent/tasks` with real SSE streaming; has conversation history sidebar; standalone full-page view
3. **Workspace Chat (`workspace/chat.tsx`)** — Uses `POST /agent/tasks` with SSE; scoped to a workspace; shows only the first conversation; isolated from other pages

This fragmentation creates confusion: users lose chat context when navigating between pages, conversation history is only accessible on the `/chats` route, and the dashboard's simulated streaming feels unresponsive. The video reference (Cursor-style IDE) demonstrates a superior pattern: a persistent right-panel chat that remains visible across all tools (Files, Skills, Computer, etc.), enabling seamless context-switching without losing the AI conversation thread.

## Goals / Non-Goals

**Goals:**
- Provide a single, persistent chat panel visible on every authenticated page
- Unify all chat interactions to use `POST /agent/tasks` with real SSE streaming
- Enable conversation history access from any page via the left sidebar
- Allow users to reference workspace files, system state, or skills contextually while chatting
- Maintain responsive behavior on mobile (collapsible/toggleable panel)

**Non-Goals:**
- Changing the agent orchestrator logic or LLM provider behavior
- Adding new AI capabilities (the agent already supports tools, personas, skills)
- Real-time collaboration or multi-user chat
- Changing the database schema (existing conversation/task tables are sufficient)
- Supporting the legacy `POST /agent/chat` endpoint (it will be removed)

## Decisions

**1. Global Panel Architecture: React Context + Layout Slot**
- **Decision**: Implement the chat panel as a React Context provider (`ChatPanelProvider`) that wraps the authenticated layout. The panel renders in a fixed right slot managed by `app/(main)/layout.tsx`.
- **Rationale**: This avoids prop drilling, ensures state persists across route changes, and allows any component to programmatically open/send messages to the panel.
- **Alternative considered**: URL-based panel state (e.g., `?chat=open`). Rejected because it causes full re-renders and complicates navigation history.

**2. Layout: Resizable Split Pane**
- **Decision**: Use `shadcn/ui` Resizable components (already in the project) to create a draggable divider between the main content area and the chat panel.
- **Rationale**: Matches the video reference exactly; users can adjust chat width based on task (wide for code review, narrow for quick questions). Panel width persists in `localStorage`.
- **Default width**: 420px desktop, 100% mobile (overlay/drawer mode)

**3. Page Refactor Strategy: Shared `ChatCore` Component**
- **Decision**: Extract a shared `ChatCore` component that handles message rendering, SSE streaming, composer input, and tool call display. This is used by the global panel. The `/chats` page becomes a "history browser" (left list, right panel shows selected conversation). The workspace page removes its local chat and uses the global panel.
- **Rationale**: Deduplicates chat logic; the global panel is the single source of truth for active conversation.
- **Alternative considered**: Keep `/chats` as a standalone full-page chat. Rejected because it duplicates the global panel's purpose.

**4. Backend: Deprecate `POST /agent/chat`**
- **Decision**: Remove the `/agent/chat` endpoint entirely. All chat flows go through `/agent/tasks`.
- **Rationale**: `/agent/tasks` already supports streaming (SSE), conversation persistence, tool approval, attachments, personas, and skills. Maintaining two endpoints is technical debt.
- **Migration**: The dashboard chat-home currently calls `/agent/chat`; it will be updated to call `/agent/tasks`.

**5. Mobile Behavior: Collapsible Drawer**
- **Decision**: On mobile (< md breakpoint), the chat panel is hidden by default. A floating action button (FAB) or bottom tab toggles a full-height slide-out drawer.
- **Rationale**: Screen real estate is limited; a persistent right panel would make the main content unusable on phones.

**6. Conversation Scope: Global (Not Workspace-Locked)**
- **Decision**: Conversations are user-scoped, not workspace-scoped. A user can chat about any workspace from any page.
- **Rationale**: Matches the video reference where the chat is a general assistant. Workspace context is injected optionally (e.g., when viewing a workspace, the active workspace ID is passed as context to the agent).
- **Alternative considered**: Workspace-scoped conversations. Rejected because it fragments history and limits the assistant's usefulness when browsing other tools.

## Risks / Trade-offs

**[Risk] Users may find the persistent panel intrusive on small screens**
→ **Mitigation**: Panel is collapsible; width is adjustable; on mobile it's a hidden drawer. Provide a "hide panel" button that remembers preference.

**[Risk] Performance impact of SSE connections on every page**
→ **Mitigation**: SSE connections are only active when a task is running. Idle state closes the EventSource. TanStack Query manages reconnection gracefully.

**[Risk] Breaking external API consumers of `POST /agent/chat`**
→ **Mitigation**: This is an internal monorepo with no documented external API consumers. Mark as breaking in release notes. The endpoint is simple enough that any internal tests using it can migrate to `/agent/tasks`.

**[Risk] Workspace chat users may miss the old workspace-scoped behavior**
→ **Mitigation**: The global panel automatically injects the active workspace context when the user is on a workspace page. This is actually an improvement — users can now reference files from other workspaces too.

**[Trade-off] Removing `/chats` standalone full-page chat loses dedicated chat browsing space**
→ **Mitigation**: The `/chats` route is preserved as a "history browser" with a large conversation list on the left and the global panel on the right. It functions as the primary entry point for managing conversations.

## Migration Plan

1. **Phase 1**: Create `ChatCore` component and `ChatPanelProvider`
2. **Phase 2**: Update `app/(main)/layout.tsx` to include resizable right panel
3. **Phase 3**: Refactor `/chats` page to use `ChatCore` + history list
4. **Phase 4**: Refactor workspace page to remove local chat, use global panel
5. **Phase 5**: Remove `chat-home.tsx` and legacy `/agent/chat` endpoint
6. **Phase 6**: Clean up unused imports and dead code
7. **Rollback**: Revert git commits; the legacy chat components can be restored from git history if needed

## Open Questions

- Should the panel remember the last open/closed state across sessions? (Recommendation: yes, via localStorage)
- Should there be a keyboard shortcut to toggle the panel? (Recommendation: `Cmd/Ctrl + B` or `Cmd/Ctrl + J`)
- How should the panel behave when the user opens a file in the workspace editor — should it auto-reference the open file? (Recommendation: future enhancement, out of scope for initial implementation)
