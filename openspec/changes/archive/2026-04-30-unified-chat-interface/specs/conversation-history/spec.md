## ADDED Requirements

### Requirement: Conversation list sidebar
The left sidebar MUST display a list of the user's conversations when the "Chats" menu item is selected.

#### Scenario: View conversation list
- **WHEN** user clicks "Chats" in the left sidebar
- **THEN** the sidebar shows a list of conversations
- **AND** each conversation displays its title or "Untitled"

#### Scenario: Day-grouped history
- **WHEN** user views the conversation list
- **THEN** conversations are grouped by date (Today, Yesterday, Last 7 days, Older)
- **AND** groups are collapsible

### Requirement: Conversation search
The conversation list MUST support searching by conversation title or content.

#### Scenario: Search conversations
- **WHEN** user types in the conversation search box
- **THEN** the list filters to show only matching conversations
- **AND** matching is case-insensitive

#### Scenario: Empty search results
- **WHEN** user searches for a term with no matches
- **THEN** an empty state message is displayed

### Requirement: Conversation selection
Clicking a conversation in the list MUST load it into the global chat panel.

#### Scenario: Select conversation
- **WHEN** user clicks a conversation in the sidebar list
- **THEN** the global chat panel loads that conversation's messages
- **AND** the conversation becomes the active conversation

#### Scenario: Active conversation highlight
- **WHEN** a conversation is active in the chat panel
- **THEN** it is visually highlighted in the sidebar list

### Requirement: Conversation deletion
Users MUST be able to delete conversations from the sidebar.

#### Scenario: Delete conversation
- **WHEN** user clicks the delete button on a conversation
- **AND** confirms the deletion
- **THEN** the conversation is removed from the list
- **AND** it is deleted from the server

#### Scenario: Delete active conversation
- **WHEN** user deletes the currently active conversation
- **THEN** the chat panel clears
- **AND** switches to "New Chat" mode

### Requirement: Conversation renaming
Users MUST be able to rename conversations.

#### Scenario: Rename conversation
- **WHEN** user clicks the rename option on a conversation
- **THEN** the title becomes editable
- **AND** saving updates the title in the list and server

### Requirement: New conversation from sidebar
The sidebar MUST provide a way to create a new conversation.

#### Scenario: Create new conversation
- **WHEN** user clicks the "New Chat" button in the sidebar
- **THEN** the global chat panel switches to a new empty conversation
- **AND** the new conversation appears in the list after first message
