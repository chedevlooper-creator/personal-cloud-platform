# Automations Page — Page Design Override

> Overrides MASTER.md for the `/automations` route.
> Non-overridden rules inherit from `MASTER.md`.

## Layout

- Header row: title + "New Automation" primary CTA, `border-b border-border pb-4`
- Filter bar: status filter, search, sort — `flex gap-2 mt-4`
- Main content: list of automation cards OR empty state
- Page padding: `p-4 md:p-6`

## Automation Card

Each automation is a card showing schedule, last run, and status:

```
┌─────────────────────────────────────────────────────┐
│ [icon] Automation Name           [status badge] [⋮] │
│ Description text (1 line, truncate)                 │
│ ─────────────────────────────────────────────────── │
│ ⏱ Every day at 9:00 AM     ▶ Last run: 2h ago ✓  │
└─────────────────────────────────────────────────────┘
```

- Card: `rounded-xl border border-border bg-card p-4 hover:border-border/80`
- Hover/focus: `ring-1 ring-ring/30`
- Click anywhere on card → open detail/edit view
- Right action menu (kebab): pause/resume, run now, edit, delete

## Status Badges

| Status   | Color                                          | Icon            |
| -------- | ---------------------------------------------- | --------------- |
| Active   | `bg-green-500/10 text-green-500 border-green-500/30` | `CheckCircle2` |
| Paused   | `bg-muted text-muted-foreground`              | `Pause`         |
| Failed   | `bg-destructive/10 text-destructive border-destructive/30` | `AlertCircle` |
| Running  | `bg-amber-500/10 text-amber-500 border-amber-500/30` | `Loader2 animate-spin` |

Badges are: `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium`

Always include icon + text (color alone is insufficient).

## Schedule Display

- Use human-readable cron: "Every day at 9:00 AM" not `0 9 * * *`
- For interval schedules: "Every 15 minutes"
- Show next run time: `text-xs text-muted-foreground` "Next run in 4h 23m"

## Last Run Indicator

- Status icon + relative time + duration
- Click to open run history detail
- Failed runs: link to logs/error in destructive color

## Empty State

- Centered: `Zap` icon, `size-12 text-muted-foreground`
- Heading: "No automations yet"
- Description: "Schedule recurring tasks for your AI agent"
- Primary CTA: "Create your first automation"

## Create/Edit Form (modal or full-page route)

- Step 1: Name + description
- Step 2: Schedule (cron builder OR interval picker, with preview text)
- Step 3: Tasks/prompt definition
- Step 4: Notification preferences

Cron builder pattern:
- Visual frequency selector: Hourly / Daily / Weekly / Monthly / Custom (cron)
- Time picker for daily/weekly options
- Preview text always visible: "This will run: every day at 9:00 AM"

## Run History (detail view)

- Table with: Run ID | Started | Duration | Status | View Logs
- `tabular-nums` for duration column
- Status column uses same badges as above
- Failed runs: expandable to show error message and traceback
- Pagination: 20 per page

## Anti-Patterns (Automations-specific)

- Don't show raw cron expressions to users without a translation
- Don't hide the "Run Now" action — discoverability matters for testing
- Don't make schedule editing inline on cards (too error-prone) — use full edit view
- Don't silently catch automation failures — surface them with notification
