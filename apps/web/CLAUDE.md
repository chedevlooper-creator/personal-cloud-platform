@../../CLAUDE.md

## Web-Specific Notes

This is **Next.js 16 + React 19** with breaking changes vs. older conventions. Read `node_modules/next/dist/docs/` before changing routing, server components, or config.

Tailwind v4 + shadcn/ui. Theme tokens in `src/app/globals.css`. Components in `src/components/ui/` (primitives) and `src/components/<feature>/` (feature-specific).

TanStack Query for API data, Zustand for workspace/editor state. Client components for interactive surfaces.
