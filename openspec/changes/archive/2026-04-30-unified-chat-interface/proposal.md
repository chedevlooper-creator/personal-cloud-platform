## Why

CloudMind OS currently has three separate chat implementations (dashboard chat-home, /chats page, workspace panel) using different backends (`/agent/chat` vs `/agent/tasks`), inconsistent persistence, and conflicting UX patterns. This fragments the user experience and creates maintenance overhead. We need a unified, persistent chat interface that follows modern IDE patterns (like Cursor) where the AI assistant is always available as a right-side companion panel, regardless of which tool the user is working with.

## What Changes

- **Remove** the legacy `POST /agent/chat` endpoint and dashboard's simulated streaming chat-home component
- **Create** a persistent Global Chat Panel fixed to the right side of all authenticated pages
- **Refactor** `/chats` page to show conversation history list on the left, with the global chat panel handling active conversation on the right
- **Refactor** workspace page to use the global chat panel instead of its own isolated chat component
- **Unify** all chat UIs to use `POST /agent/tasks` with real SSE streaming and full conversation persistence
- **Add** resizable split-pane layout between left navigation/content and right chat panel
- **Add** conversation search, day-grouped history, and quick context actions (attach files, reference workspace)
- **BREAKING**: `POST /agent/chat` endpoint will be removed. Any external consumers must migrate to `/agent/tasks`.

## Capabilities

### New Capabilities
- `global-chat-panel`: Persistent right-side chat panel visible across all authenticated pages with real SSE streaming, conversation continuity, and context-aware interactions
- `conversation-history`: Sidebar conversation list with day-grouping, search, rename, delete, and quick navigation
- `chat-context-actions`: File attachment, workspace reference, and skill/persona context injection into chat

### Modified Capabilities
- (none — this is primarily a UX refactor; backend `/agent/tasks` and conversation APIs remain unchanged)

## Impact

- **Frontend**: Major changes to `apps/web/src/app/(main)/layout.tsx` (add right panel), new `global-chat-panel.tsx`, refactored `chats/page.tsx`, refactored `workspace/[id]/page.tsx`, removal of `chat-home.tsx` and `workspace/chat.tsx`
- **Backend**: Removal of `POST /agent/chat` route in `services/agent/src/routes.ts`
- **Dependencies**: No new dependencies; uses existing `@tanstack/react-query`, SSE, and UI primitives
- **User Experience**: All authenticated pages gain persistent chat; conversation history is unified; simulated streaming replaced with real streaming
