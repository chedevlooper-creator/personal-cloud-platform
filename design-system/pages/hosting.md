# Hosting Page — Page Design Override

> Overrides MASTER.md for the `/hosting` route.
> Non-overridden rules inherit from `MASTER.md`.

## Layout

- Header: title + "Deploy New" primary CTA
- Service grid/list of hosted services
- Page padding: `p-4 md:p-6`

## Service Card

Each hosted service:

```
┌────────────────────────────────────────────────┐
│ [favicon/icon] service-name.cloudmind.app    │
│ Repository: github.com/user/repo               │
│ ──────────────────────────────────────────────│
│ ● Running   v1.2.3   Last deploy: 2h ago     │
│ [Open] [Logs] [Restart] [⋮]                  │
└────────────────────────────────────────────────┘
```

- Card: `rounded-xl border border-border bg-card p-4`
- Service URL: `text-sm font-mono text-primary hover:underline` with external-link icon
- Status dot: `2.5px` solid circle, colored by state
- Action row: ghost buttons aligned right

## Status Indicators

| State        | Dot color           | Label text          |
| ------------ | ------------------- | ------------------- |
| Running      | `bg-green-500`      | Running             |
| Building     | `bg-amber-500 animate-pulse` | Building... |
| Stopped      | `bg-zinc-500`       | Stopped             |
| Crashed      | `bg-destructive`    | Crashed             |
| Deploying    | `bg-blue-500 animate-pulse` | Deploying... |

Always paired with text label, not dot alone.

## Resource Usage Strip

Optional inline metrics within card:
- CPU: thin bar `h-1 bg-muted rounded-full` with primary fill
- Memory: same pattern
- Network: small sparkline (last 24h) — chart-1 stroke

```
CPU  [███░░░░░░░] 32%      Mem [████░░░░░░] 41%
```

Use `tabular-nums` for percentages.

## Detail View (per service)

Tabs: **Overview** | **Logs** | **Environment** | **Metrics** | **Settings**

### Overview tab
- Status card (current state, version, uptime)
- Quick actions (restart, redeploy, stop)
- Recent deployments list

### Logs tab
- Terminal-like viewer (dark always, like terminal page)
- Filters: All / stdout / stderr / Custom regex
- Auto-scroll toggle (default: on)
- Search bar (regex support)
- Timestamp toggle
- Download logs button

### Environment tab
- List of env vars with names + masked values (show/hide toggle per row)
- Edit modal with key/value input
- WARNING: encrypted-at-rest indicator badge per var
- Reveal value requires confirmation (audit log)
- Add/remove confirmation for production environments

### Metrics tab
- 4 chart cards: CPU, Memory, Network, Request rate
- Time-range selector: 1h / 6h / 24h / 7d
- Charts: line charts using `chart-1` and `chart-2` colors
- Hover tooltip with exact values

### Settings tab
- Service name (rename)
- Domain & TLS configuration
- Auto-deploy on push toggle
- Restart policy
- Danger zone at bottom: Delete service (destructive confirmation with name typing)

## Deploy Modal / Wizard

Steps:
1. Source: GitHub repo / Docker image / Upload archive
2. Build config: language detection or Dockerfile path
3. Environment variables (paste from .env or add inline)
4. Domain: subdomain on `cloudmind.app` or custom domain
5. Resource limits: CPU/memory tiers
6. Review and deploy

Show live deploy progress with streaming logs after submit.

## Empty State

- `Globe` icon, `size-12 text-muted-foreground`
- "No services deployed yet"
- "Deploy a web app, API, or static site from GitHub or a container image"
- Primary CTA: "Deploy Your First Service"

## Anti-Patterns (Hosting-specific)

- Never display environment variable values plainly without a deliberate reveal action
- Don't mask the env var **name** — only the value
- Don't allow inline destructive actions (delete service) — always require typed confirmation
- Don't show "Running" status when the service is in a degraded/crash-loop state
- Don't apply light theme to logs viewer — always dark
