## ADDED Requirements

### Requirement: Persistent right-side chat panel
The system SHALL display a chat panel fixed to the right side of every authenticated page.

#### Scenario: Panel visible on dashboard
- **WHEN** user navigates to `/dashboard`
- **THEN** the chat panel is visible on the right side of the screen

#### Scenario: Panel visible on files page
- **WHEN** user navigates to `/files`
- **THEN** the chat panel remains visible on the right side

#### Scenario: Panel visible on workspace page
- **WHEN** user navigates to `/workspace/:id`
- **THEN** the chat panel remains visible on the right side

#### Scenario: Panel survives navigation
- **WHEN** user is typing in the chat panel
- **AND** user clicks a different left sidebar menu item
- **THEN** the chat panel state (input text, conversation) persists

### Requirement: Real SSE streaming
The chat panel MUST use server-sent events (SSE) for real-time message streaming.

#### Scenario: User sends message
- **WHEN** user types a message and submits
- **THEN** an SSE connection is established to `/agent/tasks/:id/events`
- **AND** agent responses appear incrementally in the chat panel

#### Scenario: Streaming completes
- **WHEN** the agent task reaches a terminal status (completed, failed, cancelled)
- **THEN** the SSE connection closes automatically
- **AND** the streaming indicator disappears

#### Scenario: User stops generation
- **WHEN** user clicks the stop button during streaming
- **THEN** the SSE connection aborts
- **AND** the partial response remains visible

### Requirement: Resizable panel width
The chat panel MUST support horizontal resizing via a draggable divider.

#### Scenario: User resizes panel
- **WHEN** user drags the divider between content and chat panel
- **THEN** the chat panel width changes accordingly
- **AND** the new width persists across page reloads

#### Scenario: Default width
- **WHEN** user loads the application for the first time
- **THEN** the chat panel defaults to 420px width on desktop

### Requirement: Mobile responsive behavior
On mobile viewports, the chat panel MUST be hidden by default and toggleable.

#### Scenario: Mobile default state
- **WHEN** user accesses the application on a viewport narrower than 768px
- **THEN** the chat panel is hidden
- **AND** main content occupies full width

#### Scenario: Mobile panel toggle
- **WHEN** user clicks the chat toggle button on mobile
- **THEN** the chat panel slides in as a full-height overlay

### Requirement: New chat initiation
The chat panel MUST support starting a new conversation.

#### Scenario: New chat from panel
- **WHEN** user clicks the "New Chat" button in the chat panel
- **THEN** a new empty conversation is created
- **AND** the message list clears

#### Scenario: First message creates conversation
- **WHEN** user sends a message in an empty chat panel
- **THEN** a new conversation is automatically created server-side
- **AND** the conversation appears in the history list

### Requirement: Model selection
The chat panel MUST allow users to select the AI model.

#### Scenario: Model dropdown
- **WHEN** user clicks the model selector in the chat composer
- **THEN** a dropdown of available models appears
- **AND** the selected model is used for subsequent messages

### Requirement: Conversation continuity
The chat panel MUST maintain the active conversation across page navigations.

#### Scenario: Navigate and return
- **WHEN** user chats in the panel
- **AND** navigates to a different page via the sidebar
- **AND** returns to the original page
- **THEN** the same conversation and messages are visible
