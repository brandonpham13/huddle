# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read PLAYBOOK.md first

`PLAYBOOK.md` is the detailed dev reference for this repo — dashboard widget conventions, how to add a standings/power-rankings column, the trophy/award system, design tokens, and a key-file index. Consult it before touching UI or the power-rankings pipeline; keep it updated when you establish a new pattern.

## Commands

```bash
npm install && npm run install:all   # root, then client + server deps
npm run dev                          # both: server :4000, Vite client :3000

npm run dev --prefix server          # server only (tsc build + node)
npm run dev --prefix client          # client only
npm run build --prefix server        # tsc -> server/bin/
npm run build --prefix client        # tsc + vite -> client/bin/

npm run db:push --prefix server      # push Drizzle schema to Neon
npm run db:generate --prefix server  # generate a migration into server/drizzle/
npm run db:studio --prefix server    # Drizzle Studio
```

There is no test runner configured (`client/src/setupTests.ts` is a leftover). Verify changes by running the app.

Env vars live in a **single root `.env`** — not in `client/` or `server/`. Vite reads it via `envDir: '../'`; the server via `node --env-file=../.env`; Drizzle via `dotenv-cli`. Required: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`.

## Architecture

Three deployables from one repo (Vercel config in `vercel.json`):

- `client/` — Vite + React 18 + TS, built to `client/bin/`, served as the static site.
- `server/` — Express 5 app. `server/src/app.ts` exports the configured `app`; `server/src/server.ts` is the local `listen()` entrypoint.
- `api/index.ts` — re-exports `server/src/app.js` as the Vercel serverless function. **Any route must be registered inside `app.ts` (via the `init*Routes(app)` functions), not in `server.ts`,** or it won't exist in production.

In dev, Vite proxies `/api` → `localhost:4000`.

### Provider pattern (fantasy platforms)

The client never talks to Sleeper. `server/src/providers/types.ts` defines the `FantasyProvider` interface; `sleeper/` implements it; `registry.ts` maps id → implementation (ESPN/Yahoo are stubbed comments). `providerRoutes.ts` exposes `/api/provider/:providerId/...` and maps raw platform shapes into the normalized domain types in `server/src/domain/fantasy.ts` (mirrored client-side in `client/src/types/fantasy.ts`). Optional interface methods let a provider omit capabilities it doesn't have. Adding a platform should require zero client query changes.

### Two data domains

1. **Provider data** (leagues, rosters, matchups, players) — read-only passthrough, no DB, cached by TanStack Query. Hooks: `client/src/hooks/useSleeper.ts`, which documents the per-hook stale-time conventions (24h player dict → 2m live matchups). Match those tiers when adding hooks.
2. **Huddle data** (our own product layer: team claims, announcements, dues, payouts, commissioner awards, active trophies) — Neon Postgres via Drizzle, schema in `server/src/db/schema.ts`, routes in `huddleRoutes.ts`, services in `server/src/services/`, client hooks in `useHuddles.ts`. A "huddle" wraps a league family with commissioner-controlled features.

### Power rankings are server-driven

Algorithms in `server/src/algorithms/` self-register via `registerAlgorithm()` (imported from `services/powerRankingsService.ts`) and are activated by an import line in `algorithms/index.ts`. The client renders one sortable column per server-supplied entry — adding an algorithm needs no client edit.

### Auth

Clerk everywhere. Server: `clerkMiddleware()` globally + `requireAuth` per route (`getAuth(req).userId`). Client: `AuthGuard` gates the app shell and hydrates Clerk `unsafeMetadata` into the Redux `auth` slice. After mutating metadata server-side, call `await user.reload()` client-side or Redux stays stale.

### State split

Redux Toolkit holds only session/selection state (`user`, `selectedLeagueId`, `selectedYear`, persisted to `localStorage` under `huddle:selection`). All server data is TanStack Query. Don't put fetched data in Redux.

### Dashboard data ownership

`DashboardPage.tsx` fetches everything once and passes props down to the widgets in `client/src/widgets/dashboard/`. Widgets do not self-fetch. Week/season are scoped to the *selected league's* season, not live NFL state — see PLAYBOOK's note before changing week logic.

## Conventions

- Server is ESM with `"type": "module"` — relative imports must carry the `.js` extension (`./app.js`), even from `.ts` sources.
- Styling: Tailwind v4 with CSS variables in `client/src/styles/index.css`. Use the semantic utilities (`bg-paper`, `text-ink`, `border-line`, `font-serif`) rather than raw colors — dark mode swaps the variables automatically.
- Git: branch off latest `main` (`feat/`, `fix/`, `chore/`), Conventional Commits, PR for every change — no direct commits to `main` without explicit permission.
