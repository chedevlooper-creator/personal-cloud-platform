# Chats / Agent Conversation — Page Design Override

> Overrides MASTER.md for the `/chats` route (and chat surfaces inside dashboard).
> Non-overridden rules inherit from `MASTER.md`.

## Layout

- Two-pane on desktop (≥ 1024px): conversation list (left, 280px) + active chat (right, fluid)
- Mobile: single-pane with back navigation between list and conversation
- Active chat container: `max-w-3xl mx-auto` for readable line length
- Full-height column: `flex flex-col h-full min-h-0`

## Conversation List (left pane)

- Each item: `flex flex-col gap-1 p-3 rounded-lg hover:bg-muted/50`
- Active conversation: `bg-muted ring-1 ring-border`
- Title: `text-sm font-medium truncate`
- Preview: `text-xs text-muted-foreground line-clamp-1`
- Timestamp: `text-xs text-muted-foreground tabular-nums` right-aligned
- Unread indicator: `2px` dot in `primary` color, top-right of avatar/icon
- Search box at top: `<input>` with `Search` icon, `rounded-lg`

## Message Stream

- Container scrolls; auto-scrolls to bottom on new message **only if user is already at bottom**
- "Jump to latest" floating button appears when user scrolls up + new messages arrive
- Date dividers between days: `text-xs text-muted-foreground text-center my-4` with `before/after` lines

## Message Bubble Patterns

### User message
- Right-aligned, `max-w-[85%] sm:max-w-[75%]`
- Background: `bg-primary text-primary-foreground`
- Radius: `rounded-2xl rounded-br-md` (corner notch hint)
- Padding: `px-4 py-2.5`

### AI message
- Left-aligned, full container width
- No bubble background — just the text on `card` or page bg
- Avatar/icon left: AI logo or sparkle icon, `size-7`
- Name + timestamp above content: `text-xs text-muted-foreground`

### System / status message
- Centered, italic, `text-xs text-muted-foreground`
- e.g. "Conversation renamed to ...", "Session expired"

## Markdown Rendering

- Inline code: `bg-muted px-1.5 py-0.5 rounded text-sm font-mono`
- Code blocks: `bg-muted rounded-xl p-4 overflow-x-auto` with:
  - Language label top-left: `text-xs text-muted-foreground`
  - Copy button top-right: `Copy` icon, ghost variant
  - Syntax highlighting via Shiki/Prism with theme matching app
- Tables: `border border-border rounded-lg overflow-hidden`
- Links: `text-primary underline-offset-4 hover:underline`

## Tool-Call Cards

- Collapsible card embedded in AI message
- Default state: collapsed, shows tool name + status icon
- Expanded: shows input args + output preview
- Card: `border border-border rounded-xl bg-card/50 my-2`
- Status icons:
  - Running: `Loader2` with `animate-spin`, amber color
  - Success: `CheckCircle2`, green color (chart-2)
  - Error: `AlertCircle`, destructive color
- Approval gate: when tool requires approval, show `[Approve]` / `[Decline]` buttons

## Streaming State

- Last AI message gets a blinking cursor at the end while streaming
- Cursor: `▋` character or 8×16 div with `animate-pulse`, `bg-primary`
- No separate "AI is thinking" overlay during streaming — the cursor IS the indicator
- "AI is thinking" status toast (from MASTER) only shown BEFORE first token arrives

## Composer (chat input)

- Fixed to bottom of conversation pane
- `<textarea>` with auto-grow, max 8 rows then scroll internally
- Min height: `56px`, max-height: `200px`
- Attach file button (left), Send button (right), both ≥ 44px touch
- Send disabled during streaming; show "Stop" button instead
- Slash commands `/`: trigger command palette popover above composer
- File attachment chips appear above textarea, dismissible

## Anti-Patterns (Chat-specific)

- Don't show "AI is typing..." overlay AND streaming cursor simultaneously
- Don't auto-scroll if user has scrolled up to read older content
- Don't truncate code blocks — let them scroll horizontally
- Don't use bubble background on AI messages (visual weight imbalance)
- Don't put primary actions inside collapsed tool-call cards (hidden from user)
