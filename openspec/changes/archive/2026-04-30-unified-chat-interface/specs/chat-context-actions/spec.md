## ADDED Requirements

### Requirement: File attachment in chat
Users MUST be able to attach files to chat messages.

#### Scenario: Attach file via button
- **WHEN** user clicks the attachment ("+") button in the chat composer
- **THEN** a file picker opens
- **AND** selected files are uploaded to the workspace storage
- **AND** file references are included in the message sent to the agent

#### Scenario: Display attachments
- **WHEN** a message has attachments
- **THEN** the attachments are displayed as chips below the message input
- **AND** each chip shows the file name and size

#### Scenario: Remove attachment
- **WHEN** user clicks the remove button on an attachment chip
- **THEN** the attachment is removed from the pending message

### Requirement: Persona context injection
The chat MUST support selecting a persona that influences agent behavior.

#### Scenario: Select persona
- **WHEN** user selects a persona from the persona selector
- **THEN** the persona context is included in subsequent task creation requests
- **AND** the agent responds according to the selected persona

#### Scenario: Persona indicator
- **WHEN** a persona is active
- **THEN** the persona name is displayed in the chat composer area

### Requirement: Skill context injection
The chat MUST support selecting active skills that extend agent capabilities.

#### Scenario: Toggle skills
- **WHEN** user toggles skills in the skill selector
- **THEN** the selected skill IDs are included in task creation requests
- **AND** the agent can use those skills' tools

### Requirement: Workspace context awareness
When the user is on a workspace page, the chat SHOULD include workspace context.

#### Scenario: Workspace page context
- **WHEN** user is viewing a workspace page
- **AND** sends a message in the chat panel
- **THEN** the workspace ID is included in the task creation request
- **AND** the agent can reference workspace files

#### Scenario: Non-workspace page context
- **WHEN** user is on a non-workspace page (e.g., dashboard, files)
- **AND** sends a message in the chat panel
- **THEN** no specific workspace ID is sent
- **AND** the agent operates in general mode

### Requirement: Tool call display
Agent tool calls MUST be displayed in a user-friendly format within chat messages.

#### Scenario: Display tool call
- **WHEN** the agent invokes a tool
- **THEN** a tool call card appears in the message showing the tool name and arguments
- **AND** the card includes a status indicator (pending, running, completed, failed)

#### Scenario: Tool call result
- **WHEN** a tool call completes
- **THEN** the result or output is displayed within the tool call card
- **AND** the status updates to completed or failed

### Requirement: Tool approval workflow
The chat MUST support agent tool calls that require user approval.

#### Scenario: Approval required
- **WHEN** the agent invokes a tool marked as requiring approval
- **THEN** an approval card appears in the chat panel
- **AND** the user can approve or reject the tool call

#### Scenario: Approve tool call
- **WHEN** user clicks approve on a pending tool call
- **THEN** the approval is sent to the server
- **AND** the agent continues execution

#### Scenario: Reject tool call
- **WHEN** user clicks reject on a pending tool call
- **THEN** the rejection is sent to the server with an optional reason
- **AND** the agent receives the rejection and adjusts its response
