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

## Adding a column to the Standings table

File: `client/src/widgets/LeagueStandings/LeagueStandingsWidget.tsx`

1. Add any new fields you need to the `StandingsRow` interface:
```ts
interface StandingsRow {
  // ...existing fields...
  streak: number  // ← new
}
```

2. Populate it in the `.map()` that builds rows:
```ts
const rows: StandingsRow[] = (rosters ?? []).map(roster => ({
  // ...existing fields...
  streak: computeStreak(roster),  // ← new
}))
```

3. Add a column definition to the `COLUMNS` array:
```ts
{
  id: 'streak',
  label: 'Streak',
  align: 'right',
  title: 'Current win/loss streak',       // tooltip (optional)
  sortValue: row => row.streak,            // omit if not sortable
  render: row => (
    <span className="text-xs text-gray-600">{row.streak}</span>
  ),
},
```

That's it — the column appears in the table and is sortable automatically.

---

## Adding a column to the Power Rankings table

Power Rankings columns are **driven by the server** — you register an algorithm and the column appears automatically.

### 1. Create the algorithm

File: `server/src/algorithms/myAlgo.ts`

```ts
import { registerAlgorithm } from '../services/powerRankingsService.js'

registerAlgorithm({
  id: 'my_algo',           // unique snake_case key
  label: 'My Algo',        // column header
  description: 'What it measures',  // tooltip
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

Done — the new column shows up in the widget with sorting included.

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

The dashboard (`client/src/pages/DashboardPage.tsx`) is a **newspaper-style layout** — not a widget grid. Each section is a self-contained component in the same file.

To add a new section:

1. Write a new component in `DashboardPage.tsx` (co-locate it with the others):
```tsx
function MyStat({ rosters, users }: { rosters: Roster[]; users: TeamUser[] }) {
  return (
    <section>
      <SectionHead kicker="My Kicker" title="My Section" rule="subtitle" />
      {/* your content */}
    </section>
  )
}
```

2. Drop it into the page body inside `DashboardPage`:
```tsx
<div className="h-4" />
<MyStat rosters={rosters ?? []} users={users ?? []} />
```

3. Use the shared atoms for consistency:
 - `<SectionHead kicker="…" title="…" rule="…" />` — section header with rule line
 - `<Avatar avatar={...} name={...} size={20} />` — team/player avatar
 - `<Stat label="…" value="…" accent />` — single stat block
 - `<MatchupResult name={...} pts={...} won={...} />` — matchup row
 - `<Eyebrow>…</Eyebrow>` — uppercase label

### Design tokens
All colours come from CSS variables defined in `client/src/styles/index.css`. Use the Tailwind utilities:
- `bg-paper`, `bg-chrome`, `bg-highlight`
- `text-ink`, `text-body`, `text-muted`, `text-accent`
- `border-ink`, `border-line`, `divide-line`
- `font-serif` (Newsreader), `font-mono` (IBM Plex Mono)

Dark mode is automatic — variables swap when the `.dark` class is on the root `div`.

### Data available in DashboardPage
| Hook | Data |
|---|---|
| `useLeagueRosters(leagueId)` | All rosters (record, pointsFor, pointsAgainst, players[]) |
| `useLeagueUsers(leagueId)` | Team names, avatars, Sleeper user info |
| `useLeagueMatchups(leagueId, week)` | Matchup pairs + scores for a given week |
| `usePlayerStats(season, week)` | Per-player pts_ppr, rush_yd, rec_yd, etc. |
| `useNFLPlayers()` | Full player dictionary (name, position, team) |
| `useNFLState()` | Current week, season, season type |
| `usePowerRankings(leagueId)` | Algorithm-based power ranking rows + columns |
| `useMyClaimedTeam(leagueId)` | Current user's claimed team (teamName, avatar, rosterId) |

---

## The widget registry (standalone widgets)

The registry (`client/src/widgets/registry.ts`) still exists for standalone widgets used outside the main dashboard (e.g. embedded in team pages or future sidebar panels). The dashboard itself no longer uses it.

---

## Using SortableTable in a new widget

`SortableTable<T>` is a generic sortable table component. Import it and define your columns:

```ts
import { SortableTable, type TableColumn } from '../../components/SortableTable'

interface MyRow { id: number; name: string; value: number }

const COLUMNS: TableColumn<MyRow>[] = [
  {
    id: 'name',
    label: 'Name',
    render: row => <span>{row.name}</span>,
  },
  {
    id: 'value',
    label: 'Value',
    align: 'right',
    sortValue: row => row.value,
    render: row => <span>{row.value}</span>,
  },
]

// In JSX:
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

---

## Key file locations

| What | Where |
|---|---|
| Route definitions | `client/src/App.tsx` |
| Shared layout (top nav + sidebar) | `client/src/components/AppShell.tsx` |
| Sidebar nav items | `client/src/components/Sidebar.tsx` |
| Auth guard + Redux hydration | `client/src/components/auth/AuthGuard.tsx` |
| Redux auth slice | `client/src/store/slices/authSlice.ts` |
| Sleeper data hooks | `client/src/hooks/useSleeper.ts` |
| Widget registry | `client/src/widgets/registry.ts` |
| Power rankings service | `server/src/services/powerRankingsService.ts` |
| Power ranking algorithms | `server/src/algorithms/` |
| Provider routes | `server/src/routes/providerRoutes.ts` |
| DB schema | `server/src/db/schema.ts` |
