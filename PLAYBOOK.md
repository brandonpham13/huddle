# Huddle Dev Playbook

Quick reference for common development tasks. Add new sections as patterns emerge.

---

## Stack

| Layer | Tech |
|---|---|
| Client | React + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| State | Redux Toolkit (`auth` slice) |
| Data fetching | TanStack Query |
| Auth | Clerk |
| Server | Express + TypeScript |
| Database | Neon Postgres + Drizzle ORM |
| Fantasy data | Sleeper (via provider pattern) |

---

## Git workflow

- Always branch off latest `main` — never reuse a merged PR branch
- Branch naming: `feat/short-description`, `fix/short-description`, `chore/...`
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`)
- Open a PR for all changes — never commit directly to `main` unless explicitly granted permission for a trivial chore

---

## Dashboard layout

The dashboard is a **newspaper-style** layout. Each section lives in its own file under `client/src/widgets/dashboard/`:

```
client/src/widgets/dashboard/
├── _shared.tsx        # Eyebrow, SectionHead, SortHeader, MatchupResult,
│                      # teamName / teamAvatar / ordinal helpers
├── Ticker.tsx         # Top scrolling marquee (full bleed, above masthead)
├── Masthead.tsx       # Newspaper title block
├── MyTeamSection.tsx  # Lead hero with claimed-team summary (private Stat helper)
├── TopPerformers.tsx
├── LeagueTable.tsx    # Standings (sortable)
├── Scoreboard.tsx     # Matchup pairs with week nav + playoff badging
└── PowerRankings.tsx  # Server-driven sortable algorithm columns
```

`client/src/pages/DashboardPage.tsx` is the orchestrator — it fetches the shared data once and passes it down to each widget as props. Widgets are not lazy-loaded and don't self-fetch; the props-down model keeps a single owner of the dashboard's data.

---

## Adding a column to the League Table (Standings)

File: `client/src/widgets/dashboard/LeagueTable.tsx`

The League Table uses the shared `useSortedRows` hook + a custom `SortHeader` (not the generic `SortableTable` component) so it can keep the bespoke newspaper grid styling. Columns are inline JSX, not an array.

1. **Add a sort column entry** to the `sortColumns` array. The `id` must be unique; `defaultDir` decides whether the first click on the header sorts asc or desc.
```ts
{ id: 'streak', sortValue: r => computeStreak(r), defaultDir: 'desc' },
```

2. **Adjust the grid template** so there's a slot for the new column.
```ts
const LEAGUE_TABLE_GRID =
  "grid-cols-[16px_1fr_42px_42px_42px_36px_36px] sm:grid-cols-[18px_1fr_52px_52px_52px_44px_44px]";
```

3. **Add a header** in the header row, in display order:
```tsx
<SortHeader id="streak" label="Streak" currentId={sortId} dir={sortDir} onSort={handleSort} align="right" />
```

4. **Render the cell** in the body row, in the same display order:
```tsx
<div className="text-right font-mono text-[11px] text-body">{computeStreak(r)}</div>
```

Sort behavior is automatic once the column is in `sortColumns`. The leftmost `#` column always shows the canonical W–L rank from `rankByRosterId`, regardless of the active sort.

---

## Adding a column to Power Rankings

Power Rankings columns are **driven by the server**. Register an algorithm and the column appears automatically — no client edits required.

### 1. Create the algorithm

File: `server/src/algorithms/myAlgo.ts`

```ts
import { registerAlgorithm } from '../services/powerRankingsService.js'

registerAlgorithm({
  id: 'my_algo',           // unique snake_case key
  label: 'My Algo',        // column header
  description: 'What it measures',  // tooltip
  displayMode: 'score',    // 'score' (numeric) or 'rank' (#N display)
  compute({ rosters, matchupsByWeek, currentWeek }) {
    const scores = new Map<number, number>()
    for (const roster of rosters) {
      scores.set(roster.rosterId, /* your score */)
    }
    return scores  // higher score = better rank
  },
})
```

### 2. Register it

File: `server/src/algorithms/index.ts`

```ts
import './myAlgo.js'  // ← add this line
```

The client (`client/src/widgets/dashboard/PowerRankings.tsx`) renders one column per server-supplied entry in `data.columns`, with sorting wired automatically. `displayMode: 'rank'` columns sort ascending by default (rank 1 first), `'score'` sort descending.

### Algorithm input

```ts
interface PowerRankingInput {
  rosters: Roster[]          // record, pointsFor, pointsAgainst per team
  matchupsByWeek: Matchup[][] // index 0 = week 1, each Matchup has rosterId + points
  users: TeamUser[]          // display names / avatars
  currentWeek: number
}
```

---

## Adding a new section to the Dashboard

1. **Create the widget** at `client/src/widgets/dashboard/MySection.tsx`:
```tsx
import { SectionHead } from "./_shared";
import type { Roster, TeamUser } from "../../types/fantasy";

export function MySection({
  rosters,
  users,
}: {
  rosters: Roster[];
  users: TeamUser[];
}) {
  return (
    <section>
      <SectionHead kicker="My Kicker" title="My Section" rule="subtitle" />
      {/* your content */}
    </section>
  );
}
```

2. **Wire it into `DashboardPage.tsx`** — import it and drop it into the body where you want it to appear:
```tsx
import { MySection } from "../widgets/dashboard/MySection";
// ...
<div className="h-4" />
<MySection rosters={rosters ?? []} users={users ?? []} />
```

3. **Use the shared atoms** from `_shared.tsx` for visual consistency:
   - `<SectionHead kicker="…" title="…" rule="…" />` — section header (rule may be a string or arbitrary node like nav buttons)
   - `<Eyebrow>…</Eyebrow>` — uppercase accent label
   - `<MatchupResult name avatar pts won big />` — single matchup row
   - `<SortHeader … />` — clickable sort header (paired with `useSortedRows` from `client/src/components/sortable.ts`)
   - `teamName(roster, users)` / `teamAvatar(roster, users)` — display-name / avatar helpers
   - `ordinal(n)` — formats numbers as `1st`, `2nd`, etc.
   - `<Avatar avatar name size />` — from `client/src/components/Avatar.tsx` (shared between dashboard and AppShell)

### Design tokens

All colours come from CSS variables defined in `client/src/styles/index.css`. Use the Tailwind utilities:

- `bg-paper`, `bg-chrome`, `bg-highlight`
- `text-ink`, `text-body`, `text-muted`, `text-accent`
- `border-ink`, `border-line`, `divide-line`
- `font-serif` (Newsreader), `font-mono` (IBM Plex Mono)

Dark mode is automatic — variables swap when the `.dark` class is on the root `div`.

### Mobile

Default to a single column at `<sm`; use Tailwind's `sm:` / `md:` / `lg:` prefixes to layer the desktop layout on top. The page padding is `px-3 sm:px-7`. For tables that may overflow on narrow viewports, wrap the grid in `overflow-x-auto` and use `minmax()` on the flex column (see `PowerRankings.tsx`).

### Data available in DashboardPage

| Hook | Data |
|---|---|
| `useLeagueRosters(leagueId)` | All rosters (record, pointsFor, pointsAgainst, players[]) |
| `useLeagueUsers(leagueId)` | Team names, avatars, Sleeper user info |
| `useLeagueMatchups(leagueId, week)` | Matchup pairs + scores for a given week |
| `useWinnersBracket(leagueId)` | Playoff bracket structure (used by Scoreboard for badges) |
| `usePlayerStats(season, week)` | Per-player pts_ppr, rush_yd, rec_yd, etc. |
| `useNFLPlayers()` | Full player dictionary (name, position, team) |
| `useNFLState()` | Current week, season, season type |
| `usePowerRankings(leagueId)` | Algorithm-based power ranking rows + columns |
| `useMyClaimedTeam(leagueId)` | Current user's claimed team (teamName, avatar, rosterId) |

> Note: the dashboard scopes `week` and `season` to the **selected league's** season, not the live NFL state. The live week is only used when the selected league matches the active regular season; otherwise it falls back to week 17 (regular-season finale) so finished and offseason leagues still show real matchup data. Pre-draft / drafting leagues set `lastWeek` to 0 so widgets like Scoreboard can lock their nav.

---

## Sortable tables

There are two patterns; pick based on the visual style you want.

### `useSortedRows` + `SortHeader` (newspaper-style, dashboard)

Use this when you want full control over the row markup and grid layout (see `LeagueTable.tsx` and `PowerRankings.tsx`):

```tsx
import { useSortedRows, type SortableColumn } from "../../components/sortable";
import { SortHeader } from "./_shared";

const sortColumns = useMemo<SortableColumn<Roster>[]>(() => [
  { id: "rank", sortValue: r => rankBy.get(r.rosterId) ?? Infinity, defaultDir: "asc" },
  { id: "pf",   sortValue: r => r.pointsFor,                       defaultDir: "desc" },
], [rankBy]);

const { sortedRows, sortId, sortDir, handleSort } = useSortedRows(
  rosters,
  sortColumns,
  "rank",
  "asc",
);
```

Header cells are then explicit JSX — `<SortHeader id="pf" label="PF" currentId={sortId} dir={sortDir} onSort={handleSort} align="right" />` — and rows render however you want them to look.

### `<SortableTable>` (generic, card-style widgets)

Use the generic component when you want a standard `<table>` with no special styling (see future card-based widgets). Columns are an array, rendering is delegated:

```tsx
import { SortableTable, type TableColumn } from "../../components/SortableTable";

const COLUMNS: TableColumn<MyRow>[] = [
  { id: "name",  label: "Name",  render: r => <span>{r.name}</span> },
  { id: "value", label: "Value", align: "right",
    sortValue: r => r.value, render: r => <span>{r.value}</span> },
];

<SortableTable
  columns={COLUMNS}
  rows={myRows}
  getKey={r => r.id}
  defaultSortId="value"
  defaultSortDir="desc"
/>
```

Columns with a `sortValue` are clickable — first click sorts desc, second click reverses.

---

## Adding a new provider (fantasy platform)

The provider pattern lives in `server/src/providers/`. To add a new platform:

1. Create `server/src/providers/myplatform/` — implement the `FantasyProvider` interface from `../types.ts`
2. Register it in `server/src/providers/registry.ts`
3. In the client, new leagues from this provider will appear under their own `<optgroup>` in the nav dropdown (update `AppShell.tsx` to add the group)

---

## Auth & user state

User metadata flows: **Clerk `unsafeMetadata` → `AuthGuard` → Redux `auth` slice**

- `AuthGuard` calls `setUser()` once on load and again whenever Clerk's `user` object updates (e.g. after `user.reload()`)
- After mutating metadata on the server, always call `await user.reload()` on the client to keep Clerk's cache fresh
- The `auth` slice holds: `user` (id, sleeperUsername, sleeperUserId, syncedLeagueIds), `selectedLeagueId`, `selectedYear`
- `selectedLeagueId` and `selectedYear` are persisted to `localStorage` (`huddle:selection`) by the store subscriber in `client/src/store/index.ts`, so the user's chosen league/season survives a refresh.

---

## Key file locations

| What | Where |
|---|---|
| Route definitions | `client/src/App.tsx` |
| Shared layout (top nav + sidebar) | `client/src/components/AppShell.tsx` |
| Sidebar nav items | `client/src/components/Sidebar.tsx` |
| Auth guard + Redux hydration | `client/src/components/auth/AuthGuard.tsx` |
| Redux auth slice | `client/src/store/slices/authSlice.ts` |
| Redux store + persistence | `client/src/store/index.ts` |
| Sleeper data hooks | `client/src/hooks/useSleeper.ts` |
| Dashboard orchestrator | `client/src/pages/DashboardPage.tsx` |
| Dashboard widgets | `client/src/widgets/dashboard/*.tsx` |
| Dashboard shared atoms | `client/src/widgets/dashboard/_shared.tsx` |
| Shared `Avatar` | `client/src/components/Avatar.tsx` |
| Sortable hook + types | `client/src/components/sortable.ts` |
| Generic `SortableTable` | `client/src/components/SortableTable.tsx` |
| League family helpers | `client/src/utils/leagueFamily.ts` |
| Power rankings service | `server/src/services/powerRankingsService.ts` |
| Power ranking algorithms | `server/src/algorithms/` |
| Provider routes | `server/src/routes/providerRoutes.ts` |
| DB schema | `server/src/db/schema.ts` |
