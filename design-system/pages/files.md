# Files Page — Page Design Override

> Overrides MASTER.md for the `/files` route.
> Non-overridden rules inherit from `MASTER.md`.

## Surface & Background

- **Decorative glows**: OFF — data-dense utility page
- **Dot background**: OFF
- **Layout**: Full-height column; toolbar + breadcrumb + table/grid area
- Outer padding: `p-4 md:p-6`

## Toolbar (top of files area)

- Contains: breadcrumb (left), actions right-aligned (Upload, New Folder, View toggle)
- Height: `h-12` with `border-b border-border`
- Actions: `ghost` or `outline` variant buttons; Upload is `default` (primary)
- View toggle (grid/list): icon-only buttons with `aria-label`

## Breadcrumb

- Font: `text-sm text-muted-foreground`; current path segment: `text-foreground font-medium`
- Separator: `/` or chevron icon `size-3 text-muted-foreground`
- Truncate long paths at 3 levels: `Root / ... / CurrentFolder`
- Each segment is keyboard-navigable

## File Table (list view)

- Columns: Checkbox | Name | Type/Icon | Size | Modified | Actions
- Row height: `h-10` (40px) — data-dense but touchable
- Selected rows: `bg-primary/10` highlight
- Hover: `bg-muted/50`
- Name column: left-aligned with file-type icon (`size-4 mr-2`)
- Size/Date: `text-muted-foreground text-sm tabular-nums`
- Sort: click column headers; `aria-sort` on `<th>` for screen readers

## File Grid (card view)

- Grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3`
- Card: `rounded-xl border border-border bg-card p-3 hover:bg-muted/50`
- Thumbnail area: `aspect-square bg-muted rounded-lg` with file-type icon centered
- Filename: `text-xs mt-2 truncate` (tooltip with full name on overflow)
- Selected: `ring-2 ring-primary`

## Empty State

- Centered in the table/grid area
- Icon: Folder or Upload Lucide icon, `size-12 text-muted-foreground`
- Heading: `"No files yet"` text-lg font-medium
- Sub-text: `"Upload files or create a folder to get started"` text-muted-foreground
- CTA: primary button "Upload Files"

## Context Menu (right-click / action menu)

- Items: Open, Rename, Download, Copy, Move, Delete
- Delete item: `text-destructive` with icon, separated by a divider

## Batch Actions Bar (appears when files selected)

- Sticky at bottom of files area when selection > 0
- Background: `bg-card/95 backdrop-blur-sm border-t border-border`
- Contains: selection count, Download, Move, Delete buttons
- Delete: `destructive` variant, triggers confirmation dialog

## Anti-Patterns (Files-specific)

- No glassmorphism on table rows
- No decorative blobs that would compete with file thumbnails
- Don't truncate filenames in list view — wrap or use full column width
