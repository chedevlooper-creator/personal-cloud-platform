# Settings Page — Page Design Override

> Overrides MASTER.md for the `/settings` route.
> Non-overridden rules inherit from `MASTER.md`.

## Layout

- Desktop (≥ 1024px): Two-column — left sub-nav (200px) + right content area
- Mobile/tablet: Tabs at top, content below (no two-column)
- Max content width: `max-w-2xl` within the right column (keeps line length readable)
- Content padding: `p-6`

## Settings Sub-Navigation

Left sidebar nav on desktop:

| Section          | Icon (Lucide)  |
| ---------------- | -------------- |
| General          | `Settings2`    |
| Profile          | `User`         |
| Appearance       | `Palette`      |
| API Keys         | `Key`          |
| Integrations     | `Plug`         |
| Notifications    | `Bell`         |
| Billing          | `CreditCard`   |
| — (divider) —   |                |
| Danger Zone      | `AlertTriangle` (text-destructive) |

Active item: `bg-sidebar-accent text-sidebar-accent-foreground rounded-md`
Danger Zone item: `text-destructive` color, separated by `border-t border-border mt-2 pt-2`

## Section Cards

Each settings group is a `<Card>` component:
- `rounded-xl border border-border bg-card p-6`
- Card heading: `<h2>` text-lg font-semibold, `mb-1`
- Card description: `text-sm text-muted-foreground mb-4`
- Divider between settings rows: `border-t border-border my-4`

## Settings Row Pattern

```
[Label + description]          [Control: toggle / input / select / button]
```

- Row: `flex items-center justify-between gap-4 py-3`
- Label: `text-sm font-medium`
- Description: `text-xs text-muted-foreground mt-0.5`
- Control: right-aligned, `shrink-0`

## Danger Zone

- Rendered in a separate card at the bottom of the page
- Card: `border-destructive/40 bg-destructive/5`
- Section title: `text-destructive font-semibold`
- Delete Account: `destructive` button variant, triggers 2-step confirmation dialog

## Confirmation Dialog (for destructive settings actions)

- Title: clearly states what will be deleted/revoked
- Body: explains consequence and any irreversibility
- Actions row: `[Cancel]` (ghost) then `[Delete / Revoke]` (destructive) — Cancel is left, Destructive is right
- For "Delete Account": require typing the account name to confirm

## Forms in Settings

- Inline save (save button per section) vs. auto-save depends on field type:
  - Text fields: show "Save Changes" button, disabled until dirty
  - Toggles/selects: save on change (optimistic UI with toast confirmation)
- Unsaved changes: show "You have unsaved changes" banner above the section
- API keys: show/hide toggle; copy-to-clipboard button; never show key after creation (only once)

## Anti-Patterns (Settings-specific)

- Don't put Danger Zone actions inline with normal settings
- Don't auto-save destructive changes (deletion, key revocation)
- Don't use modals for navigation within settings (use sub-nav sections)
- Don't truncate setting descriptions — users need context to make decisions
