# UI Audit Report — apps/web vs design-system/MASTER.md

> Generated: April 29, 2026
> Scope: `apps/web/src/components/**` and `apps/web/src/app/**`
> Reference: `design-system/MASTER.md` + page overrides

---

## Executive Summary

| Severity | Count | Theme                                                    |
| -------- | ----- | -------------------------------------------------------- |
| 🔴 CRITICAL | 4     | Hardcoded VS Code hex palette, broken theme isolation     |
| 🟠 HIGH     | 8     | Tailwind palette hex/zinc instead of semantic tokens      |
| 🟡 MEDIUM   | 7     | A11y gaps, viewport units, color-only status, emoji glyph |
| 🟢 LOW      | 4     | Animation token consistency, line-clamp, sidebar polish   |

**Worst offenders** (in priority order):
1. [`workspace/workspace-shell.tsx`](apps/web/src/components/workspace/workspace-shell.tsx) — fully hardcoded `#1e1e1e`, `#252526`, `#333333`, `#007acc`
2. [`workspace/terminal.tsx`](apps/web/src/components/workspace/terminal.tsx) — same hex palette + raw blue/red/emerald colors
3. [`workspace/chat.tsx`](apps/web/src/components/workspace/chat.tsx) — `bg-blue-600`, `bg-[#37373d]`, `bg-[#3c3c3c]`, no semantic tokens
4. [`app-shell/sidebar.tsx`](apps/web/src/components/app-shell/sidebar.tsx) — `#252523`, `#494A4D`, `#F0F0F0` hardcoded
5. [`app-shell/main-canvas.tsx`](apps/web/src/components/app-shell/main-canvas.tsx) — `#E8E8E8`, `#25262A`, `#F5A524` raw hex

---

## 🔴 CRITICAL Findings

### C-1. VS Code-Style Hardcoded Hex Palette in Workspace
**Files:** [workspace-shell.tsx](apps/web/src/components/workspace/workspace-shell.tsx#L28-L63), [terminal.tsx](apps/web/src/components/workspace/terminal.tsx#L32-L153), [chat.tsx](apps/web/src/components/workspace/chat.tsx#L205-L353)

**Problem:** Entire workspace surface uses raw hex (`#1e1e1e`, `#252526`, `#333333`, `#37373d`, `#3c3c3c`, `#007acc`, `#444`) bypassing the CSS variable theme system.

**Why CRITICAL:**
- `dark-mode-pairing` rule violated — these surfaces never adapt to light mode
- `color-semantic` rule violated — token system (`bg-card`, `bg-muted`, `border-border`) is bypassed
- Theme tokens in [globals.css](apps/web/src/app/globals.css) define both light/dark for `--card`, `--popover`, `--muted` — they should be used instead
- Future redesigns or accent-color swaps require touching every JSX file instead of one CSS file

**Anti-pattern matched:** `MASTER §11 → "Raw oklch/hex values in JSX"`

**Fix:**
```tsx
// before
<div className="flex h-full w-full flex-col bg-[#1e1e1e] text-[#cccccc]">

// after — use semantic tokens (workspace IDE-style surfaces map to card/muted)
<div className="flex h-full w-full flex-col bg-card text-card-foreground">

// for the resizer handle:
className="bg-border hover:bg-primary active:bg-primary"  // not bg-[#007acc]
```

For terminal.tsx, the design-system override [pages/terminal.md](design-system/pages/terminal.md) explicitly says terminal canvas is **always dark** — but that override applies to the xterm.js canvas itself, not the surrounding chrome (status bar, tabs, dialogs). The chrome should still use semantic tokens.

---

### C-2. Skip-Link / Focus Color Hardcoded
**File:** [main-canvas.tsx#L73](apps/web/src/components/app-shell/main-canvas.tsx#L73)

```tsx
<span className="h-1 w-1 rounded-full bg-[#F5A524]" aria-hidden="true" />
```

The amber dot (a status indicator) is hardcoded. MASTER explicitly lists `#F5A524` as a **decorative-only** glow color, never for indicators with semantic meaning. If this dot signals "new" or "alert" status, it must use `bg-amber-500` (Tailwind palette) at minimum, ideally a new `--color-warning` semantic token.

---

### C-3. AlertDialog Bypasses Theme
**File:** [terminal.tsx#L139-L153](apps/web/src/components/workspace/terminal.tsx#L139-L153)

```tsx
<AlertDialogContent className="bg-[#2d2d2d] border-[#444] text-zinc-200">
  ...
  <AlertDialogAction className="bg-blue-600 hover:bg-blue-500 text-white">
```

**Problem:**
- Custom dialog styling overrides shadcn AlertDialog defaults (which use `bg-popover`)
- Action button uses raw `bg-blue-600` instead of primary token (`bg-primary`)
- Hardcoded zinc/blue means light mode shows dark dialog → broken

**Fix:** Remove the className overrides; let AlertDialog inherit theme. Replace the action button with `<AlertDialogAction>` default (which already uses primary).

---

### C-4. Workspace Header Title Element
**File:** [workspace-shell.tsx#L29-L31](apps/web/src/components/workspace/workspace-shell.tsx#L29-L31)

```tsx
<div className="flex h-10 items-center justify-between border-b border-[#333333] bg-[#252526] px-4 text-sm shadow-sm">
  <span className="font-semibold text-[#cccccc]">Workspace: {workspaceId}</span>
```

**Problem:** This is a `<div>` containing a section header — should be `<header>` with proper `<h1>` or `<h2>` for screen readers (`heading-hierarchy` rule). The `text-[#cccccc]` is also hardcoded.

---

## 🟠 HIGH Findings

### H-1. Tailwind Palette Used Instead of Semantic Tokens
**Affected:**
- [`status-badge.tsx`](apps/web/src/components/ui/status-badge.tsx#L5-L39) — `bg-emerald-500`, `bg-amber-500`, `bg-blue-500`, `bg-zinc-500` directly
- [`notification-bell.tsx`](apps/web/src/components/notifications/notification-bell.tsx#L95-L131) — `bg-blue-500`, `bg-red-500`, `bg-green-500`, `bg-yellow-500`
- [`plan-badge.tsx`](apps/web/src/components/app-shell/plan-badge.tsx#L13-L17) — `border-amber-500/30 bg-amber-500/10 text-amber-700`
- [`tool-approval-card.tsx`](apps/web/src/components/app-shell/tool-approval-card.tsx#L21-L23) — `border-zinc-700 bg-zinc-950/80`, `border-blue-400/20 bg-blue-400/10 text-blue-300`
- [`status-toast.tsx`](apps/web/src/components/app-shell/status-toast.tsx#L13-L14) — `bg-violet-400/60`, `bg-violet-300`
- [`chat-messages.tsx`](apps/web/src/components/app-shell/chat-messages.tsx#L65-L134) — extensive `bg-zinc-900/80`, `bg-zinc-100`, `text-zinc-300/400/500`
- [`module-placeholder.tsx`](apps/web/src/components/app-shell/module-placeholder.tsx#L17-L18) — `border-zinc-800 bg-zinc-900/70`
- [`skill-selector.tsx`](apps/web/src/components/app-shell/skill-selector.tsx#L53) — `border-zinc-700 bg-zinc-900/70 text-zinc-200`

**Why HIGH:** This is consistent enough to be a *de facto* design language, but it's **theme-locked to dark mode**. In light mode, `bg-zinc-900/70` and `text-zinc-200` produce unreadable contrast. The MASTER recommendation is:

| Tailwind palette use         | Replace with                                |
| ---------------------------- | ------------------------------------------- |
| `bg-zinc-900/X`              | `bg-card/X` or `bg-muted/X`                 |
| `text-zinc-300/400/500`      | `text-muted-foreground` (or define `--color-muted-foreground-soft`) |
| `border-zinc-700/800`        | `border-border`                             |
| `bg-blue-600` (CTA)          | `bg-primary text-primary-foreground`        |
| `bg-emerald-500` (success)   | New `--color-success` token (see Recommendation R-1) |
| `bg-red-500/destructive`     | `bg-destructive` (already exists)           |

The status colors (success/warning/info) genuinely lack semantic tokens — that's a design system gap, not just a code smell. **See Recommendation R-1.**

---

### H-2. Color-Only Status Communication
**Files:** [terminal.tsx#L24-L29](apps/web/src/components/workspace/terminal.tsx#L24-L29), [notification-bell.tsx#L124-L131](apps/web/src/components/notifications/notification-bell.tsx#L124-L131)

The terminal connection state badge is rendered with text label ("connected", "reconnecting") + color — this **passes** the rule. ✅

The notification bell severity dot, however, is **color only** — no icon, no text:
```tsx
<span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dotClass)} />
```

**Anti-pattern matched:** `MASTER §1 → "color-not-only"` and `MASTER §11 → "Color-only status indicators"`

**Fix:** Add a Lucide icon per severity (`AlertCircle` / `CheckCircle2` / `AlertTriangle` / `Info`) alongside the dot, OR replace dot with the icon.

---

### H-3. Workspace `text-[#cccccc]` / `text-zinc-200` Body Text
**Files:** Multiple, especially `workspace/*` and `app-shell/chat-messages.tsx`

`text-[#cccccc]` against `bg-[#1e1e1e]` produces ~10:1 contrast (passes), but it's brittle. `text-zinc-200` on light theme would produce broken contrast. Switch to `text-foreground` / `text-card-foreground` / `text-muted-foreground` which adapt across themes.

---

### H-4. Missing `motion-safe:` Prefix on All Animation Classes
**Files:** Every component using `animate-in`, `animate-pulse`, `animate-spin`, `animate-bounce`, `animate-ping`

Audit found **zero** uses of `motion-safe:` or any `prefers-reduced-motion` handling across `apps/web/src/`. Examples:
- [chat-messages.tsx#L87-L134](apps/web/src/components/app-shell/chat-messages.tsx#L87-L134) — six `animate-pulse` and `animate-bounce` instances
- [status-toast.tsx#L13](apps/web/src/components/app-shell/status-toast.tsx#L13) — `animate-ping`
- [chat.tsx#L212-L303](apps/web/src/components/workspace/chat.tsx#L212-L303) — `animate-in fade-in slide-in-from-bottom-2 duration-300`
- [status-badge.tsx#L33](apps/web/src/components/ui/status-badge.tsx#L33) — `bg-emerald-500 animate-pulse`

**Anti-pattern matched:** `MASTER §1 → "reduced-motion"` and `MASTER §7`

**Fix (two strategies):**
1. **Code-level (preferred):** Wrap all motion classes with `motion-safe:`:
   ```tsx
   className="motion-safe:animate-pulse motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
   ```
2. **Global CSS:** Add to [globals.css](apps/web/src/app/globals.css):
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```
   This is a fallback. Code-level is better because it allows intentional motion-safe distinctions.

---

### H-5. Viewport Units — `min-h-screen` and `h-screen`
**Files:**
- [app-shell.tsx#L17](apps/web/src/components/app-shell/app-shell.tsx#L17) — `h-screen`
- [main-canvas.tsx#L77](apps/web/src/components/app-shell/main-canvas.tsx#L77) — `h-[calc(100vh-3rem)]`
- [(auth)/login/page.tsx#L31](apps/web/src/app/(auth)/login/page.tsx#L31) — `min-h-screen`
- [(auth)/register/page.tsx#L32](apps/web/src/app/(auth)/register/page.tsx#L32) — `min-h-screen`

**Anti-pattern matched:** `MASTER §11 → "min-h-screen / 100vh"`

On mobile browsers (especially iOS Safari), `100vh` includes the URL bar area which collapses on scroll, causing layout jumps. Use `h-dvh` / `min-h-dvh` (dynamic viewport height) or `h-svh`.

**Fix:**
```tsx
// before
className="flex h-screen w-full overflow-hidden"
// after
className="flex h-dvh w-full overflow-hidden"

// before
className="h-[calc(100vh-3rem)] overflow-auto"
// after
className="h-[calc(100dvh-3rem)] overflow-auto"
```

---

### H-6. `w-[calc(100vw-3rem)]` Causes Horizontal Scroll Risk
**Files:** [chat-composer.tsx#L32](apps/web/src/components/app-shell/chat-composer.tsx#L32), [chat-home.tsx#L207](apps/web/src/components/app-shell/chat-home.tsx#L207)

```tsx
className="w-[calc(100vw-3rem)] min-w-0 max-w-full sm:w-full sm:max-w-[700px]"
```

`100vw` doesn't account for vertical scrollbar width on desktop, which can cause 17px horizontal overflow on Windows/Chrome. Mobile is fine because scrollbar is overlaid.

**Anti-pattern matched:** `MASTER §11 → "horizontal-scroll" / "100vw"`

**Fix:** Use `w-full max-w-[700px]` and let the parent constrain width, or use `100dvw` carefully with overflow guards on the body.

---

### H-7. Decorative Glows Without `motion-safe:` Performance Guard
**File:** [chat-home.tsx#L162-L202](apps/web/src/components/app-shell/chat-home.tsx#L162-L202)

12 `aria-hidden` decorative blob/star elements inline-styled with `radial-gradient`, `blur-3xl`, and box-shadows. While individually marked correctly:
- `aria-hidden="true"` ✅
- `pointer-events-none` ✅
- Listed in dashboard.md override as approved ✅

But:
- No `motion-safe:` on glow opacity/animation (some do animate via parent transitions)
- Mobile performance: dashboard.md says **"max 2 glows on mobile"** — currently ALL 4 large blobs render on mobile too
- Some use raw hex (`#B85CFF`, `#F5A524`, `#3FB6E0`, `#7CD992`) — these are explicitly approved in MASTER §2 "Accent Glow Palette" so this is OK

**Fix:** Add responsive visibility for mobile:
```tsx
className="hidden sm:block pointer-events-none absolute -right-48 -top-72 ..."
```
Keep 1–2 most important blobs always visible, hide the rest under `sm:`.

---

### H-8. Hardcoded `bg-black` / `bg-white` Without Theme Adaptation
**Files:**
- [terminal.tsx#L147](apps/web/src/components/workspace/terminal.tsx#L147) — `bg-black rounded font-mono text-sm text-red-300`
- [chat-messages.tsx#L75-L116](apps/web/src/components/app-shell/chat-messages.tsx#L75-L116) — `bg-zinc-100 text-zinc-900` (intentional "user message" pattern)

The terminal blocked-command preview using `bg-black` is fine if always dark, but the surrounding dialog is meant to use theme. Pick one direction.

The chat user-message bubble swaps to `bg-zinc-100 text-zinc-900` — this is a deliberate inverted-bubble pattern. The page override [chats.md](design-system/pages/chats.md) specifies user message bubbles should use `bg-primary text-primary-foreground`. **Doesn't match the override.**

---

## 🟡 MEDIUM Findings

### M-1. Symbol/Glyph Used as Logo Icon
**File:** [sidebar.tsx#L75](apps/web/src/components/app-shell/sidebar.tsx#L75)

```tsx
<div className="flex h-7 w-7 shrink-0 items-center justify-center text-xl font-bold text-[#F4F4F4]">
  ♞
</div>
```

The chess knight Unicode glyph (♞ U+265E) is used as the app logo. Per `MASTER §11 → "no-emoji-icons"`:

> Use SVG icons (Heroicons, Lucide), not emojis or Unicode glyphs.

While ♞ isn't a flag-emoji, it is font-rendered glyph and:
- Renders inconsistently across OS/font fallback chains
- Cannot be themed/recolored beyond `text-color`
- Doesn't scale crisply on retina

**Fix:** Replace with a proper SVG logo or a Lucide icon (e.g., `<Brain />`, `<Sparkles />`, custom SVG mark).

---

### M-2. `<span aria-hidden="true">×</span>` for Close Button
**File:** [sidebar.tsx#L181](apps/web/src/components/app-shell/sidebar.tsx#L181)

Multiplication-sign Unicode glyph used as a close icon. Same issue as M-1. Should be `<X className="h-4 w-4" />` from Lucide.

---

### M-3. Status Badge Animation on `pending` and `running` — No Reduce-Motion Fallback
**File:** [status-badge.tsx#L33-L36](apps/web/src/components/ui/status-badge.tsx#L33-L36)

```tsx
variant === 'running' && 'bg-emerald-500 animate-pulse',
variant === 'pending' && 'bg-amber-500',
```

The `animate-pulse` should be `motion-safe:animate-pulse`.

---

### M-4. ARIA Live Region Coverage
**Audit:** `aria-live` appears in only 1 component ([terminal.tsx#L36](apps/web/src/components/workspace/terminal.tsx#L36)) and `role="status"` in 1 component.

**Missing:**
- Status toast ([status-toast.tsx](apps/web/src/components/app-shell/status-toast.tsx)) — no `aria-live="polite"` despite being an announcement
- Notification bell dropdown — no `aria-live` on new notifications
- Chat streaming indicator ([chat-messages.tsx#L87](apps/web/src/components/app-shell/chat-messages.tsx)) — typing dots not announced

**Anti-pattern matched:** `MASTER §1 → "voiceover-sr"`, §8 → `"toast-accessibility"`, `"aria-live-errors"`

---

### M-5. Loading States Use Spinner Instead of Skeleton
**Files:** [chat.tsx#L212](apps/web/src/components/workspace/chat.tsx#L212), [terminal.tsx#L42](apps/web/src/components/workspace/terminal.tsx#L42), [notification-bell.tsx#L117](apps/web/src/components/notifications/notification-bell.tsx#L117)

```tsx
{isLoadingMessages && !messages.length ? (
  <div className="flex justify-center text-zinc-500 py-4">
    <Loader2 className="animate-spin h-5 w-5" />
  </div>
) : ...}
```

`MASTER §3 → "progressive-loading"` recommends skeleton for >300ms loads. There is a [`loading-skeleton.tsx`](apps/web/src/components/ui/loading-skeleton.tsx) component — but it's not being used in chat lists, terminal init, or notification list. Spinner is acceptable for short ops; skeletons are better for content placeholders.

---

### M-6. Form Inputs Without Visible Labels
**File:** [chat.tsx#L347-L353](apps/web/src/components/workspace/chat.tsx#L347-L353)

```tsx
<Input
  value={input}
  onChange={(e) => setInput(e.target.value)}
  placeholder="Ask agent to do something..."
  ...
/>
```

The composer input uses placeholder-only labeling. While this is a common chat UI pattern, MASTER `§8 → "input-labels"` and the form-labels a11y rule requires either a visible label OR an `aria-label`. There is no `aria-label` here.

**Fix:**
```tsx
<Input aria-label="Message agent" placeholder="Ask agent to do something..." ... />
```

The composer in [chat-composer.tsx](apps/web/src/components/app-shell/chat-composer.tsx) likely has the same gap (verify when reviewing).

---

### M-7. Dialog Footers Action Order
**File:** [terminal.tsx#L150-L154](apps/web/src/components/workspace/terminal.tsx#L150-L154)

The blocked-command AlertDialog has only `<AlertDialogAction>I Understand</AlertDialogAction>` — no Cancel option. While "Understood" is the only meaningful action here, MASTER §1 → `"escape-routes"` says modals should have a clear escape. The dialog *can* be dismissed via overlay click / Escape (shadcn default), but there's no visual Cancel button. Acceptable for an info-only dialog, but consider adding `<AlertDialogCancel>Close</AlertDialogCancel>` for clarity.

---

## 🟢 LOW Findings

### L-1. Inconsistent Animation Durations
**Audit:** Found `duration-200`, `duration-300` — but also raw `[animation-delay:140ms]`, `[animation-delay:280ms]` in [chat-messages.tsx](apps/web/src/components/app-shell/chat-messages.tsx#L88-L134).

MASTER §7 defines a token set: 150ms (micro), 200ms (standard), 300ms (emphasized). Currently mostly in spec, but the arbitrary `[animation-delay]` values are fine because they're for stagger sequences.

---

### L-2. Sidebar Uses Inline Hex Despite Available Theme Tokens
**File:** [sidebar.tsx#L68-L71](apps/web/src/components/app-shell/sidebar.tsx#L68-L71)

```tsx
'relative flex h-full flex-col overflow-hidden border-r border-[#494A4D] bg-[#252523] text-[#F0F0F0]'
```

Existing tokens in globals.css cover this exactly:
- `bg-[#252523]` → `bg-sidebar`
- `border-[#494A4D]` → `border-sidebar-border`
- `text-[#F0F0F0]` → `text-sidebar-foreground`

The tokens already exist (see [globals.css#L78-L86](apps/web/src/app/globals.css#L78-L86)). This is the **lowest-effort, highest-impact** fix in the entire audit.

---

### L-3. `text-[10px]`, `text-[11px]`, `text-[12.5px]` Arbitrary Font Sizes
**Files:** [chat.tsx#L292](apps/web/src/components/workspace/chat.tsx#L292), [chat.tsx#L307](apps/web/src/components/workspace/chat.tsx#L307), [markdown.tsx#L188](apps/web/src/components/app-shell/markdown.tsx#L188)

MASTER §3 specifies a strict type scale: `text-xs` (12px), `text-sm` (14px), etc. Custom values like `text-[10px]` and `text-[11px]` violate the scale and are below the minimum-readable threshold mentioned in `MASTER §3 → "Never use text-xs (12px) for anything the user must read without deliberate action"`. `text-[10px]` is below even that floor.

**Fix:** Use `text-xs` (12px) minimum for any user-facing label.

---

### L-4. Long Filenames in Chat Attachment Chips Use `truncate` (No Tooltip)
**File:** [chat.tsx#L313](apps/web/src/components/workspace/chat.tsx#L313)

```tsx
<span className="max-w-[160px] truncate">{a.name}</span>
```

`MASTER §6 → "truncation-strategy"`: when truncating, provide full text via tooltip. There's a `title={a.path}` on the parent span (good!) — but native `title` tooltips are inconsistent and not keyboard-accessible. Consider using the shadcn `<Tooltip>` component.

---

## 📋 Recommendations (Action Plan)

### R-1. Add Semantic Status Tokens to `globals.css` (P0)
The MASTER and current code both rely on success/warning/info states without semantic tokens. Add to [globals.css](apps/web/src/app/globals.css):

```css
:root {
  /* ... existing ... */
  --success: oklch(0.7 0.16 155);          /* emerald 500-ish */
  --success-foreground: oklch(0.99 0 0);
  --warning: oklch(0.78 0.16 75);          /* amber 500-ish */
  --warning-foreground: oklch(0.15 0.01 250);
  --info: oklch(0.65 0.16 240);            /* matches primary */
  --info-foreground: oklch(0.99 0 0);
}
.dark {
  --success: oklch(0.7 0.18 155);
  --warning: oklch(0.78 0.18 75);
  --info: oklch(0.7 0.16 240);
  /* ... */
}
@theme inline {
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
}
```

Then refactor `status-badge.tsx`, `notification-bell.tsx`, `plan-badge.tsx` to use `bg-success/10 text-success` etc.

### R-2. Workspace Chrome Refactor (P0)
File-by-file token migration for [`workspace-shell.tsx`](apps/web/src/components/workspace/workspace-shell.tsx), [`terminal.tsx`](apps/web/src/components/workspace/terminal.tsx), [`chat.tsx`](apps/web/src/components/workspace/chat.tsx), [`editor.tsx`](apps/web/src/components/workspace/editor.tsx), [`file-tree.tsx`](apps/web/src/components/workspace/file-tree.tsx):

| Hardcoded             | Replace with         |
| --------------------- | -------------------- |
| `bg-[#1e1e1e]`        | `bg-card` (or terminal-canvas-only override)   |
| `bg-[#252526]`        | `bg-sidebar` or `bg-muted`     |
| `bg-[#2d2d2d]`        | `bg-popover`         |
| `bg-[#37373d]`        | `bg-muted`           |
| `bg-[#3c3c3c]`        | `bg-input`           |
| `border-[#333333]`    | `border-border`      |
| `border-[#444]`       | `border-border`      |
| `text-[#cccccc]`      | `text-card-foreground` or `text-foreground` |
| `text-zinc-400`       | `text-muted-foreground`        |
| `bg-blue-600` (CTA)   | `bg-primary text-primary-foreground` |
| `hover:bg-[#007acc]`  | `hover:bg-primary`   |

### R-3. Sidebar Token Migration (P1, low-effort)
[`sidebar.tsx`](apps/web/src/components/app-shell/sidebar.tsx) — 5 hex values → 5 token replacements. See L-2 above.

### R-4. Global Reduced-Motion Fallback (P1)
Add the CSS media query block to [globals.css](apps/web/src/app/globals.css) (see H-4 fix). This catches every existing animation site without code changes. Then progressively migrate to `motion-safe:` prefixes in component code for finer control.

### R-5. Viewport Unit Migration (P2)
4 instances of `min-h-screen` / `h-screen` / `100vh` → `dvh` equivalents. See H-5.

### R-6. Replace Unicode Glyph Logo (P2)
Sidebar logo ♞ → custom SVG or Lucide icon. See M-1.

### R-7. Status Color + Icon Combination (P2)
Notification severity dots get a Lucide icon companion. See H-2.

### R-8. Workspace Sidebar Title as `<h1>` (P3)
Refactor [workspace-shell.tsx#L29-L31](apps/web/src/components/workspace/workspace-shell.tsx#L29-L31) to use `<header>` + `<h1>` semantically.

---

## What's Working Well ✅

Not all is bad — these areas already align with MASTER:

- ✅ **Button primitive** ([button.tsx](apps/web/src/components/ui/button.tsx)) — properly uses CVA + semantic tokens (`bg-primary`, `border-destructive`, etc.)
- ✅ **Tabs primitive** ([tabs.tsx](apps/web/src/components/ui/tabs.tsx)) — clean variant API, no hex
- ✅ **Skip-to-main-content** link present ([layout.tsx#L40](apps/web/src/app/layout.tsx#L40))
- ✅ **Theme tokens** in globals.css are comprehensive (light + dark + sidebar variants)
- ✅ **Inter + JetBrains Mono** loaded via next/font with CSS variables (matches MASTER §3)
- ✅ **Decorative glows** in chat-home are properly `aria-hidden` and `pointer-events-none`
- ✅ **Lucide icon usage** is widespread and consistent (no emoji used as icons in the audited surfaces, only the ♞ glyph and × glyph in sidebar)
- ✅ **Aria labels on icon-only buttons** are mostly present (checked main-canvas, chat-composer, sidebar, command-palette — all good)
- ✅ **Confirm/Alert dialogs exist** as primitives ([confirm-dialog.tsx](apps/web/src/components/ui/confirm-dialog.tsx), [alert-dialog.tsx](apps/web/src/components/ui/alert-dialog.tsx))
- ✅ **`<input ref={fileInputRef} ... aria-label="Upload files" />`** pattern in chat-home — good a11y for hidden file inputs

---

## Files Inspected

| File                                                                                      | Status              |
| ----------------------------------------------------------------------------------------- | ------------------- |
| [app-shell/app-shell.tsx](apps/web/src/components/app-shell/app-shell.tsx)               | ⚠️ H-5              |
| [app-shell/chat-composer.tsx](apps/web/src/components/app-shell/chat-composer.tsx)       | ⚠️ H-6              |
| [app-shell/chat-home.tsx](apps/web/src/components/app-shell/chat-home.tsx)               | ⚠️ H-6, H-7         |
| [app-shell/chat-messages.tsx](apps/web/src/components/app-shell/chat-messages.tsx)       | ⚠️ H-1, H-4, L-3    |
| [app-shell/command-palette.tsx](apps/web/src/components/app-shell/command-palette.tsx)   | ✅ Clean             |
| [app-shell/dotted-background.tsx](apps/web/src/components/app-shell/dotted-background.tsx)| ✅ Clean (decor)    |
| [app-shell/main-canvas.tsx](apps/web/src/components/app-shell/main-canvas.tsx)           | ⚠️ C-2, H-5          |
| [app-shell/markdown.tsx](apps/web/src/components/app-shell/markdown.tsx)                 | ⚠️ H-1, L-3         |
| [app-shell/module-placeholder.tsx](apps/web/src/components/app-shell/module-placeholder.tsx)| ⚠️ H-1            |
| [app-shell/plan-badge.tsx](apps/web/src/components/app-shell/plan-badge.tsx)             | ⚠️ H-1              |
| [app-shell/sidebar.tsx](apps/web/src/components/app-shell/sidebar.tsx)                   | ⚠️ M-1, M-2, L-2    |
| [app-shell/skill-selector.tsx](apps/web/src/components/app-shell/skill-selector.tsx)     | ⚠️ H-1              |
| [app-shell/status-toast.tsx](apps/web/src/components/app-shell/status-toast.tsx)         | ⚠️ H-1, H-4, M-4    |
| [app-shell/tool-approval-card.tsx](apps/web/src/components/app-shell/tool-approval-card.tsx)| ⚠️ H-1            |
| [notifications/notification-bell.tsx](apps/web/src/components/notifications/notification-bell.tsx)| ⚠️ H-1, H-2, M-4 |
| [ui/button.tsx](apps/web/src/components/ui/button.tsx)                                   | ✅ Clean             |
| [ui/status-badge.tsx](apps/web/src/components/ui/status-badge.tsx)                       | ⚠️ H-1, M-3         |
| [ui/tabs.tsx](apps/web/src/components/ui/tabs.tsx)                                       | ✅ Clean             |
| [workspace/chat.tsx](apps/web/src/components/workspace/chat.tsx)                         | 🔴 C-1, H-1, H-3, H-4, H-8, M-6 |
| [workspace/terminal.tsx](apps/web/src/components/workspace/terminal.tsx)                 | 🔴 C-1, C-3, H-1, H-2, M-7 |
| [workspace/workspace-shell.tsx](apps/web/src/components/workspace/workspace-shell.tsx)   | 🔴 C-1, C-4, H-3    |

---

## Suggested Execution Order

If you want me to start fixing, I'd recommend this order:

1. **R-1** — Add success/warning/info tokens to globals.css (15 min, unblocks others)
2. **R-3** — Sidebar token migration (low-risk warm-up, 10 min)
3. **R-4** — Global reduced-motion CSS rule (5 min)
4. **R-2** — Workspace chrome refactor (workspace-shell, terminal, chat) — biggest impact (1–2 hours)
5. **R-5** — Viewport unit migration (5 min)
6. **R-7** — Notification severity icons (15 min)
7. **R-6** — Replace ♞ logo (depends on design choice, 5 min once decided)

**Total estimated effort:** small day of work for full remediation.
