## 1. Foundation

- [x] 1.1 Create `ChatCore` component (`apps/web/src/components/chat/chat-core.tsx`) with message list, SSE streaming, composer input, and tool call display
- [x] 1.2 Create `ChatPanelContext` (`apps/web/src/components/chat/chat-panel-context.tsx`) for global chat state management
- [x] 1.3 Create `ChatPanelProvider` that wraps authenticated layout and persists active conversation state
- [x] 1.4 Add panel width state to `localStorage` with default 420px on desktop

## 2. Global Chat Panel UI

- [x] 2.1 Create `GlobalChatPanel` component (`apps/web/src/components/chat/global-chat-panel.tsx`) with fixed right panel
- [x] 2.2 Panel renders as fixed right-side container (resizable enhancement deferred)
- [x] 2.3 Implement panel open/close toggle button in app shell header
- [x] 2.4 Implement mobile responsive behavior: hidden by default, full-screen overlay on toggle
- [x] 2.5 Update `app/(main)/layout.tsx` to include `ChatPanelProvider` and global panel slot

## 3. Chat Composer & Context Actions

- [x] 3.1 Port composer UI from `chat-composer.tsx` into `ChatCore` with textarea, model selector, persona selector
- [x] 3.2 Implement file attachment flow: upload via `workspaceApi`, display attachment chips, include paths in message
- [x] 3.3 Implement "New Chat" button in panel header that creates empty conversation
- [x] 3.4 Add keyboard shortcut (`Cmd/Ctrl + J`) to toggle panel open/close

## 4. Conversation History Sidebar

- [x] 4.1 Update `chats/page.tsx` to show conversation list on left (global panel handles chat on right)
- [x] 4.2 Implement day-grouped conversation list (Today, Yesterday, Last 7 days, Older)
- [x] 4.3 Add conversation search input with case-insensitive filtering
- [x] 4.4 Implement conversation selection: click loads conversation into global panel
- [x] 4.5 Implement conversation delete with confirmation dialog
- [x] 4.6 Implement conversation rename with inline editing
- [x] 4.7 Add "New Chat" button at top of conversation list

## 5. Workspace Integration

- [x] 5.1 Refactor `workspace/[id]/page.tsx` — workspace shell no longer embeds local chat
- [x] 5.2 Inject active `workspaceId` into `ChatPanelContext` when on workspace pages
- [x] 5.3 Ensure workspace panel tabs on mobile: Agent tab toggles global panel
- [x] 5.4 Remove `Chat` dynamic import from `workspace-shell.tsx`

## 6. Dashboard & Legacy Cleanup

- [x] 6.1 Remove `chat-home.tsx` and its simulated streaming logic
- [x] 6.2 Update `dashboard/page.tsx` to show placeholder (no embedded chat)
- [x] 6.3 Remove `POST /agent/chat` endpoint from `services/agent/src/routes.ts`
- [x] 6.4 Update keyboard shortcut provider — `Cmd/Ctrl + J` toggles chat panel
- [x] 6.5 Update command palette "New chat" action to toggle panel and clear conversation
- [x] 6.6 Sidebar "Sohbetler" link navigates to `/chats` (history + global panel)

## 7. Polish & Testing

- [x] 7.1 Active conversation highlight in sidebar list implemented
- [x] 7.2 Panel state (open/closed, width) persists across sessions via localStorage
- [x] 7.3 SSE streaming integrated in `ChatCore` with per-task EventSource
- [x] 7.4 Tool call cards render in `ChatCore` with status badges
- [x] 7.5 Mobile overlay behavior implemented
- [x] 7.6 `pnpm typecheck` clean across all 10 packages ✓
- [x] 7.7 Dead code removed: `chat-home.tsx`, `workspace/chat.tsx`, `/agent/chat` endpoint
