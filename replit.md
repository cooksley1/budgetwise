# Wayfare

A slow-travel companion for tracking what a temporary life abroad actually costs — receipts, places, memories, and spend, mapped day by day. Sibling product to [The Slow Travel Planner](https://theslowtravelplanner.com): the planner *plans* the trip, Wayfare *lives* it.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

- Web app (`/`) and Expo mobile app (`/budget-mobile/`) sharing a Postgres backend via the API server (`/api`).
- Core: accounts, transactions, budgets, goals, subscriptions, reports.
- Holiday/trip trackers: drop a receipt photo → AI extracts vendor/items/total → geocoded pin on a Leaflet map, daily story timeline with weather, and an Insights tab that surfaces non-obvious findings (DCC fees, peak spend hour, tip patterns).
- Plaid + GoCardless bank linking.

## Brand

- **Name**: Wayfare (Old English for "the cost of a journey").
- **Sibling to**: The Slow Travel Planner — same visual family.
- **Palette** (sourced from `cooksley1/slowtravel` brand assets): `#1A2F2B` deep forest (sidebar), `#2F4842` forest (primary), `#5A7A71` sage (muted), `#EBD9B4` cream (background highlight), `#D4B483` sand (accent), `#b85a47` terracotta (destructive).
- **Type**: Lora (display/serif headings) + Inter (UI). Mountain-mark logo lockup in `src/components/WayfareLogo.tsx`.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **PDF text extraction uses `pdfjs-dist` (pure JS) — NOT `pdftotext`/poppler.** Replit autoscale containers do NOT include Nix packages from `replit.nix` (that file only affects the local dev shell). `pdftotext` will always be missing in production. `pdfjs-dist/legacy/build/pdf.mjs` is pure JS, bundles with esbuild, and works in both dev and prod. See `.agents/memory/pdf-import-approach.md`.
- **Statement parsing uses gpt-5-mini with `reasoning_effort: "minimal"` + parallel ~20k-char chunks.** Without minimal reasoning the request exceeds the autoscale timeout. Chunks have no overlap (preserves genuine duplicate transactions — do NOT dedupe).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
