# Frontend Implementation Plan (Phase 9)

## Summary
This plan outlines the implementation of the Next.js frontend for the Personal Cloud Platform (Phase 9 of the `BUILD_PLAN.md`). It focuses on building the authentication flows, the main dashboard, and the core Workspace IDE which integrates the Monaco Editor, Xterm.js Terminal, and the Agent Chat interface.

## Current State Analysis
- **Infrastructure**: The `apps/web` directory is initialized with Next.js App Router, React 19, Tailwind CSS v4, shadcn/ui, TanStack Query, and Zustand.
- **Components**: Only the `button.tsx` component is present from shadcn/ui. The Next.js starter page is still at `app/page.tsx`.
- **State**: A basic `workspace.ts` Zustand store exists, and `QueryClientProvider` is configured in `providers.tsx`.
- **Backend Readiness**: According to `PROGRESS.md`, Phases 1-5 (Auth, Workspace, Runtime, Agent, Memory) are completed, meaning the frontend can integrate with actual local API endpoints (e.g., `http://localhost:4000`).

## Proposed Changes

### 1. Authentication & Route Protection
- **`apps/web/src/middleware.ts`**: Implement Next.js Middleware to protect authenticated routes (`/dashboard`, `/workspace`, `/settings`, `/apps`). Redirect unauthenticated users to `/login`.
- **`apps/web/src/app/(auth)/login/page.tsx`**: Create the login page with email/password and OAuth options.
- **`apps/web/src/app/(auth)/register/page.tsx`**: Create the registration page.
- **`apps/web/src/lib/auth.ts`**: Add utility functions to handle session fetching and token management.

### 2. Main Layout & Dashboard
- **`apps/web/src/app/(main)/layout.tsx`**: Create a shared layout for the application shell, including a global navigation sidebar (Dashboard, Workspaces, Published Apps, Settings).
- **`apps/web/src/app/(main)/dashboard/page.tsx`**: Build the dashboard displaying a summary of the user's workspaces, recent agent tasks, and quick actions to create a new workspace.

### 3. Workspace IDE (`app/workspace/[id]/page.tsx`)
Create a dedicated layout and page for the IDE environment. It will feature a flexible, pane-based layout (e.g., using `react-resizable-panels` if added, or CSS Grid):
- **Left Sidebar (File Explorer)**: `components/workspace/file-tree.tsx`. Will interact with the Workspace File API.
- **Center Pane (Code Editor)**: `components/workspace/editor.tsx`. Will wrap `@monaco-editor/react` to edit the currently selected file.
- **Bottom Panel (Terminal)**: `components/workspace/terminal.tsx`. Will wrap `@xterm/xterm` and `@xterm/addon-fit` to connect to the Runtime WebSocket.
- **Right Sidebar (Agent Chat)**: `components/workspace/chat.tsx`. Will handle user prompts and display Agent task streams (SSE).

### 4. Data Fetching Strategy (Hybrid)
- **Server-Side Fetching**: Use Next.js Server Components to fetch initial data (e.g., the workspace list or initial file tree) and pass it to the client via React Query's `HydrationBoundary`.
- **Client-Side Interactivity**: Use `useQuery` and `useMutation` for dynamic actions like creating files, sending chat messages, or spawning runtimes.

### 5. Settings & Published Apps
- **`apps/web/src/app/(main)/settings/page.tsx`**: Page for managing user settings, quotas, and OAuth integrations.
- **`apps/web/src/app/(main)/apps/page.tsx`**: Page to view and manage applications deployed via the Publish service.

### 6. Additional UI Components
- Add necessary shadcn/ui components: `dialog`, `input`, `label`, `dropdown-menu`, `toast` (or `sonner`), `tabs`, and potentially `resizable` for the IDE layout.

## Assumptions & Decisions
- The frontend will communicate with the API Gateway/Backend services running on `http://localhost:4000`.
- We will use standard HTTP cookies (`HTTP-only`) for session management, meaning `fetch` and `axios` calls will need `credentials: 'include'`.
- The IDE layout will be modular. Since a custom layout approach was preferred (or left open), we will use standard CSS Grid or Flexbox to allow toggling panes (e.g., hiding the terminal or chat when not needed).

## Verification Steps
1. Start the frontend (`pnpm --filter web dev`) and verify that visiting `/dashboard` without a session redirects to `/login`.
2. Successfully log in and view the Dashboard.
3. Navigate to a Workspace ID and ensure the Monaco editor, File Tree, and Terminal UI mount without errors.
4. Verify that data fetching works (React Query Devtools can be enabled temporarily if needed).
