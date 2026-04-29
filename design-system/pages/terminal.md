# Terminal Page — Page Design Override

> Overrides MASTER.md for the `/terminal` route.
> Non-overridden rules inherit from `MASTER.md`.

## Critical Override: Always Dark

The terminal canvas **must always use a dark background** regardless of the app's active theme (light or dark mode). xterm.js renders text with its own dark theme config.

```ts
// Terminal initialization config
const terminal = new Terminal({
  theme: {
    background: '#0d0d0f',   // near-black, not affected by CSS vars
    foreground: '#e8e8f0',
    cursor: '#65a6e0',
    selectionBackground: 'rgba(101, 166, 224, 0.3)',
    black: '#1a1a2e',
    brightBlack: '#3d3d52',
    red: '#f87171',
    brightRed: '#fca5a5',
    green: '#4ade80',
    brightGreen: '#86efac',
    yellow: '#fbbf24',
    brightYellow: '#fcd34d',
    blue: '#60a5fa',
    brightBlue: '#93c5fd',
    magenta: '#c084fc',
    brightMagenta: '#d8b4fe',
    cyan: '#22d3ee',
    brightCyan: '#67e8f9',
    white: '#d1d5db',
    brightWhite: '#f9fafb',
  },
  fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
  fontSize: 14,
  lineHeight: 1.5,
  cursorBlink: true,
  cursorStyle: 'block',
  allowTransparency: false,
  scrollback: 10000,
});
```

## Layout

- Terminal canvas: fills full available height (`flex-1 min-h-0`)
- Container: `flex flex-col h-full` — no padding on the terminal canvas itself
- Status bar at bottom: `h-8 bg-zinc-950 border-t border-zinc-800 flex items-center px-3`

## Status Bar

- Left: session name / container ID (`text-xs text-zinc-400 font-mono`)
- Center: connection status dot (green=connected, red=disconnected, amber=reconnecting) with text label
- Right: rows × cols size, keyboard shortcut hint

Status dot colors (always explicit, not via CSS vars — terminal is always dark):
- Connected: `bg-green-400`
- Disconnected: `bg-red-400`  
- Reconnecting: `bg-amber-400 animate-pulse`

## Toolbar (above terminal)

- Session tabs if multiple sessions: tab strip with `+` button to add
- Tab: `text-xs font-mono text-zinc-400` active: `text-zinc-100 bg-zinc-800`
- Actions right: Clear, Split (future), Settings icon
- Height: `h-9 border-b border-zinc-800 bg-zinc-950`

## Font Sizing

- Default: 14px JetBrains Mono
- User can adjust (settings): 12px / 14px / 16px options
- Line height: 1.5 (xterm lineHeight config)

## Accessibility Note

- xterm.js has limited screen-reader support by default
- Add `aria-label="Terminal"` on the containing div
- Provide keyboard focus indicator on the terminal container (not inside xterm canvas)
- Document keyboard shortcuts in a help tooltip/overlay

## Anti-Patterns (Terminal-specific)

- Never apply light-mode styles to the terminal canvas — always dark
- Don't add `backdrop-blur` or glassmorphism to the terminal surface
- Don't clip `overflow` on the xterm container — breaks scrollback
- Don't constrain terminal to a max-width — fill available space
