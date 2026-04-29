# Dashboard / Chat Home — Page Design Override

> Overrides MASTER.md for the `/dashboard` route.
> Non-overridden rules inherit from `MASTER.md`.

## Surface & Background

- **Decorative glows**: ON. Use 3–4 radial blobs (`aria-hidden`):
  - Violet `#B85CFF` at top-right, `opacity-[0.12]`
  - Amber `#F5A524` bottom-left, `opacity-[0.09]`
  - Ice blue `#3FB6E0` left diagonal ray, `opacity-[0.07]`
  - Mint `#7CD992` bottom-right, `opacity-[0.08]`
- **Dot background**: ON, `opacity-45`, masked at top and bottom edges
- **Layout**: Vertically centered column, `max-w-2xl` for chat input area
- **Overflow**: Hidden on container to prevent blob scroll

## Typography

- Greeting heading: `text-3xl font-semibold` on desktop, `text-2xl` on mobile
- Subheading/description: `text-muted-foreground text-base`
- Chat input: `text-base` (16px minimum, no auto-zoom on iOS)

## Chat Input Bar

- Fixed to bottom of main canvas (not page bottom)
- Full width within `max-w-2xl` container
- Visual: `rounded-2xl border border-white/[0.07] bg-card/80 backdrop-blur-sm shadow-lg`
- Send button: primary variant, icon-only with `aria-label="Send message"`
- Typing area min-height: `56px` (comfortable touch target)
- Shift+Enter for newline; Enter to submit

## Quick-Action Chips (suggestion pills)

- Row below input: horizontally scrollable on mobile, wrapping on desktop
- Style: `rounded-full border border-border bg-muted text-sm text-muted-foreground hover:bg-accent`
- Min height: `32px` (secondary action, not primary CTA)
- Max 4–5 chips; overflow hides to keep UI clean

## Status Toast (AI thinking indicator)

- Anchored above chat input, animated in from top
- Glassmorphism surface: existing `StatusToast` component pattern
- Pulsing violet dot: `animate-ping` outer ring, solid inner
- Includes "Stop" action button
- `aria-live="polite"` on container

## Anti-Patterns (Dashboard-specific)

- No dense data tables here — this is a conversational surface
- No sidebar-style secondary navigation within the canvas
- No more than 2 decorative glow elements on mobile (performance)
