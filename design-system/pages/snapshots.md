# Snapshots Page — Page Design Override

> Overrides MASTER.md for the `/snapshots` route.
> Non-overridden rules inherit from `MASTER.md`.

## Layout

- Header: title + "Create Snapshot" primary CTA + auto-snapshot settings (gear icon)
- Filter bar: workspace filter, date range, search
- Main: timeline list of snapshots
- Page padding: `p-4 md:p-6`

## Snapshot Timeline

Vertical timeline with snapshots grouped by day:

```
Today
  ●─── 14:32  Manual snapshot          [Restore] [Download] [⋮]
  │    "Before refactor" · 142 MB · 1,247 files
  │
  ●─── 09:00  Auto-snapshot            [Restore] [Download] [⋮]
  │    Daily backup · 138 MB · 1,235 files
  │
Yesterday
  ●─── 22:15  Manual snapshot          [Restore] [Download] [⋮]
       "Working state" · 135 MB · 1,210 files
```

- Day group header: `text-sm font-semibold sticky top-0 bg-background/95 backdrop-blur-sm py-2`
- Timeline rail: `border-l border-border pl-6 ml-3`
- Snapshot dot: `size-3 rounded-full bg-primary -ml-[34px] mt-1.5 ring-4 ring-background`
- Auto-snapshot dot: `bg-muted-foreground` (lower visual weight)

## Snapshot Card

- `rounded-lg border border-border bg-card/50 p-4`
- Title (label): `text-sm font-medium`; auto-snapshots use italic "Auto-snapshot"
- Metadata row: `text-xs text-muted-foreground tabular-nums`
  - Type · Size · File count · Workspace name
- Action buttons right-aligned: Restore (primary intent), Download, kebab menu

## Restore Confirmation Dialog

- **Critical destructive operation** — requires explicit confirmation
- Title: "Restore from snapshot?"
- Body: 
  - "This will replace your current workspace state with the snapshot from {date}."
  - Lists what will change: file count delta, size delta
  - Warning box: "Your current state will be saved as an automatic snapshot before restore."
- Actions: `[Cancel]` (ghost) + `[Restore Snapshot]` (destructive variant — orange/amber, NOT red, since restore is reversible)
- Note: Use amber/warning style not destructive red — restore creates a backup first

## Snapshot Detail View

Click snapshot to see:
- Full metadata
- File-level diff vs. previous snapshot (added / modified / removed counts)
- Optional: file tree explorer of snapshot contents (read-only)
- Download as `.tar.gz` button

## Auto-Snapshot Settings (gear modal)

- Frequency: Off / Hourly / Daily / Weekly
- Retention: Keep last N snapshots (slider 5–50)
- Trigger conditions:
  - On schedule (cron-like)
  - Before destructive operations (toggle)
  - Before deploys (toggle)
- Show storage usage estimate

## Empty State

- `Camera` icon, `size-12 text-muted-foreground`
- "No snapshots yet"
- "Snapshots let you save and restore your workspace state at any point in time"
- Primary CTA: "Create Your First Snapshot"
- Secondary text link: "Configure auto-snapshots"

## Storage Usage Indicator

Top-right of page: small badge showing total snapshot storage
- `text-xs text-muted-foreground`
- Format: "Using 2.4 GB of 10 GB" with thin progress bar
- When > 80%: switch to amber warning color
- Click to open snapshot management / cleanup view

## Anti-Patterns (Snapshots-specific)

- Don't auto-restore without confirmation — always require explicit user action
- Don't use red destructive color for Restore (it creates a safety backup); use amber warning
- Don't delete old snapshots silently when storage fills — warn user first
- Don't show snapshot diffs that are too large to render (1000+ files) — show summary only
- Don't allow concurrent restore operations — disable while one is in progress
