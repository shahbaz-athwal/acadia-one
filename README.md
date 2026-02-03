# Dryft Dashboard

Single-app Next.js dashboard with Convex for backend data/functions.

## Prerequisites

- Bun (>=1.3)
- Convex CLI (`bunx convex` or `npm i -g convex`)
- Biome (optional, for lint/format)

## Setup

1. Copy `.env.example` to `.env.local` and fill in values.
2. Install deps: `bun install`
3. Configure/start Convex: `bun run dev:setup` (first time) or `bun run dev:convex`
4. Start Next.js: `bun run dev`

## Scripts

- `bun run dev` — Next.js dev server
- `bun run dev:convex` — Convex dev server
- `bun run build` — Production build
- `bun run start` — Start production build
- `bun run lint` — Biome checks
- `bun run format` — Biome format
