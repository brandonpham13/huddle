/**
 * DashboardPage — the home / "/" route, rendered inside AppShell.
 *
 * Plays the **orchestrator** role for the newspaper-style dashboard:
 *   1. Pulls the currently-selected league out of Redux (`auth.selectedLeagueId`).
 *   2. Fetches every shared piece of data the dashboard needs in one place
 *      (rosters, users, matchups, players, stats, power rankings, NFL state,
 *      league families) using the TanStack Query hooks in `hooks/useSleeper.ts`
 *      and friends.
 *   3. Derives a "display week" appropriate for the selected league (see the
 *      `isLeagueCurrent` block) so each widget receives consistent values.
 *   4. Composes the widgets from `widgets/dashboard/*` and passes the data
 *      down as props — there's no lazy loading or registry, just plain props.
 *
 * If you're adding a new dashboard section, see PLAYBOOK.md ("Adding a new
 * section to the Dashboard"). Most of the time you'll create a new file
 * under `widgets/dashboard/`, then plumb its props through this orchestrator.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import {
  useAllSleeperLeagues,
  useLeague,
  useLeagueMatchups,
  useLeagueRosters,
  useLeagueUsers,
  useNFLState,
  useNFLPlayers,
  usePlayerStats,
  useMaxPF,
} from "../hooks/useSleeper";
import { usePowerRankings } from "../hooks/usePowerRankings";
import { getFamilySeasons } from "../utils/leagueFamily";
import { useMyClaimedTeam } from "../hooks/useMyClaimedTeam";
import { useMyHuddles } from "../hooks/useHuddles";
import { Ticker } from "../widgets/dashboard/Ticker";
import { Masthead } from "../widgets/dashboard/Masthead";
import { MyTeamSection } from "../widgets/dashboard/MyTeamSection";
import { TopPerformers } from "../widgets/dashboard/TopPerformers";
import { LeagueTable } from "../widgets/dashboard/LeagueTable";
import { Scoreboard } from "../widgets/dashboard/Scoreboard";
import { PowerRankings } from "../widgets/dashboard/PowerRankings";

/**
 * Shown when the user has no huddle-linked league yet.
 */
function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center font-serif italic text-muted text-lg">
        <Link to="/leagues" className="text-accent hover:underline">
          Create or join a huddle
        </Link>{" "}
        to get started.
      </div>
    </div>
  );
}

export function DashboardPage() {
  // -----------------------------------------------------------------------
  // Step 1: Read selection state out of Redux.
  //
  // `selectedLeagueId` is the currently-active league, persisted to
  // localStorage by the store subscriber in `store/index.ts`. AppShell
  // auto-selects from leagues linked to the user's huddles; DashboardPage
  // just consumes whichever value is already set.
  // -----------------------------------------------------------------------
  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );

  // Determine whether the user has any huddle-linked leagues available.
  // `syncedLeagueIds` (Clerk metadata) no longer drives the dashboard —
  // only leagues linked to a huddle the user belongs to are shown.
  const { data: myHuddles } = useMyHuddles();
  const hasLinkedLeague = (myHuddles ?? []).some((h) => !!h.leagueId);

  // -----------------------------------------------------------------------
  // Step 2: Fetch the global / per-league reference data.
  //
  // All of these are TanStack Query hooks, which means they're cached
  // across re-renders and shared with any other component that calls them
  // (Sidebar, AppShell, etc.). See `hooks/useSleeper.ts` for the actual
  // queries — they hit the `/api/provider/sleeper/...` endpoints on our
  // Express backend, which proxies + normalizes the Sleeper public API.
  // -----------------------------------------------------------------------
  const { data: allLeagues } = useAllSleeperLeagues();
  const { data: selectedLeague } = useLeague(selectedLeagueId);
  const { data: nflState } = useNFLState();
  const { data: players } = useNFLPlayers();

  // Scope display week + season to the selected league. The live NFL state's
  // current week is only meaningful when the selected league is for the
  // currently-active regular season; otherwise fall back to the regular-season
  // finale (week 17) so Ticker / Scoreboard / Top Performers show real data
  // instead of an empty preseason or wrong-year window.
  const isLeagueCurrent =
    !!selectedLeague?.season &&
    !!nflState?.season &&
    selectedLeague.season === nflState.season &&
    nflState.season_type === "regular";

  const week = isLeagueCurrent
    ? (nflState!.display_week ?? nflState!.week ?? 1)
    : 17;
  const season = selectedLeague?.season ?? nflState?.season ?? "2024";
  const nextWeek = isLeagueCurrent && week < 18 ? week + 1 : week;

  const leagueSettings = selectedLeague?.settings ?? {};
  const playoffWeekStart =
    typeof leagueSettings["playoff_week_start"] === "number"
      ? (leagueSettings["playoff_week_start"] as number)
      : null;
  const lastScoredLeg =
    typeof leagueSettings["last_scored_leg"] === "number"
      ? (leagueSettings["last_scored_leg"] as number)
      : null;

  // Sleeper omits last_scored_leg for pre-draft / drafting leagues, so falling
  // back to playoff_week_start would (incorrectly) advertise weeks 17/18 as
  // navigable. Pin to 0 when the league hasn't kicked off so Scoreboard locks
  // its prev/next nav.
  const leagueStatus = selectedLeague?.status;
  const isLeagueUnstarted =
    leagueStatus === "pre_draft" || leagueStatus === "drafting";
  const lastWeek = isLeagueUnstarted
    ? 0
    : (lastScoredLeg ?? (playoffWeekStart ? playoffWeekStart + 2 : 17));

  // -----------------------------------------------------------------------
  // Step 4: Per-league data fetches keyed off `(selectedLeagueId, week)`.
  //
  // TanStack Query keys these by their args, so swapping leagues or weeks
  // automatically refetches without us having to manage cache invalidation.
  // `nextMatchups` uses week=0 as a "disabled" sentinel — the hook returns
  // undefined in that case (see useLeagueMatchups), which keeps the
  // "Next week preview" card empty for past-season leagues.
  // -----------------------------------------------------------------------
  const { data: rosters } = useLeagueRosters(selectedLeagueId);
  const { data: users } = useLeagueUsers(selectedLeagueId);
  const { data: matchups } = useLeagueMatchups(selectedLeagueId, week);
  const { data: nextMatchups } = useLeagueMatchups(
    selectedLeagueId,
    nextWeek !== week ? nextWeek : 0,
  );
  const { data: playerStats } = usePlayerStats(season, week);
  const { data: powerData } = usePowerRankings(selectedLeagueId);
  // weekCount for Max PF: use last_scored_leg if available, otherwise stop at
  // playoff_week_start - 1 (regular season only). Disable for unstarted leagues.
  const maxPFWeekCount = isLeagueUnstarted
    ? null
    : lastScoredLeg
      ? lastScoredLeg
      : playoffWeekStart
        ? playoffWeekStart - 1
        : null;
  const { data: maxPFData } = useMaxPF(selectedLeagueId, maxPFWeekCount);

  // -----------------------------------------------------------------------
  // Step 5: Derive the "league family" (same league across multiple seasons).
  //
  // Sleeper assigns each league season its own leagueId, but links them via
  // `previousLeagueRef`. `getFamilySeasons` walks that chain to return every
  // season belonging to the selected league's family, sorted newest-first.
  // We use this for:
  //   - the season dropdown in AppShell's nav
  //   - the masthead "ESTABLISHED <year>" eyebrow
  //   - resolving the user's claimed team (claims live on the newest season
  //     in the family, not on whichever season is currently selected)
  // -----------------------------------------------------------------------
  const familySeasons = useMemo(
    () =>
      selectedLeagueId && allLeagues
        ? getFamilySeasons(selectedLeagueId, allLeagues)
        : [],
    [selectedLeagueId, allLeagues],
  );

  // Bottom-most entry in `familySeasons` (which is sorted newest-first) is
  // the founding year of the league. Used by Masthead's "ESTABLISHED" line.
  const oldestYear = useMemo(
    () => familySeasons.at(-1)?.season ?? selectedLeague?.season ?? null,
    [familySeasons, selectedLeague],
  );

  // The newest season's leagueId for this family. Claims (huddle membership)
  // are stored against the newest season, so claim lookup needs this even
  // when the user is currently viewing an older season.
  const currentFamilyLeagueId =
    familySeasons[0]?.ref.leagueId ?? selectedLeagueId;
  const { rosterId: myRosterId } = useMyClaimedTeam(currentFamilyLeagueId);

  // Show content only when a league is both selected and linked to a huddle.
  const hasLeague = !!selectedLeagueId && hasLinkedLeague;

  // -----------------------------------------------------------------------
  // Step 6: Render. The newspaper layout, top-to-bottom:
  //
  //   ┌─────────────────────────────────────────┐
  //   │ <Ticker>  scrolling marquee, full bleed │
  //   ├─────────────────────────────────────────┤
  //   │ <Masthead>  league name + "Established" │
  //   ├─────────────────────────────────────────┤
  //   │ <MyTeamSection>  hero, claimed team     │
  //   │ <TopPerformers>  5-up player grid       │
  //   │ <LeagueTable>  <Scoreboard>  <PowerRk>  │ ← 3-col on lg+
  //   └─────────────────────────────────────────┘
  //
  // Each widget owns its own internal layout; this orchestrator only
  // controls page padding (px-3 sm:px-7) and inter-section spacing.
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-full bg-paper text-ink font-sans flex flex-col">
      {!hasLeague ? (
        <EmptyState />
      ) : (
        <>
          <Ticker
            matchups={matchups}
            rosters={rosters ?? []}
            users={users ?? []}
            week={week}
          />

          <Masthead
            leagueName={selectedLeague?.name ?? ""}
            week={week}
            oldestYear={oldestYear}
          />

          <div className="px-3 sm:px-7 pt-4 pb-6 flex-1">
            <MyTeamSection
              myRosterId={myRosterId}
              rosters={rosters ?? []}
              users={users ?? []}
              matchups={matchups}
              nextMatchups={nextMatchups}
              week={week}
              nextWeek={nextWeek}
              powerRows={powerData?.rows ?? []}
            />

            <div className="h-4" />

            <TopPerformers
              rosters={rosters ?? []}
              users={users ?? []}
              playerStats={
                playerStats as
                  | Record<string, Record<string, number>>
                  | undefined
              }
              matchups={matchups}
              players={players}
              week={week}
            />

            <div className="h-4" />

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_0.9fr] gap-6">
              <LeagueTable
                rosters={rosters ?? []}
                users={users ?? []}
                myRosterId={myRosterId}
                maxPF={maxPFData}
              />
              <Scoreboard
                rosters={rosters ?? []}
                users={users ?? []}
                leagueId={selectedLeagueId!}
                currentWeek={isLeagueUnstarted ? 1 : week}
                playoffWeekStart={playoffWeekStart}
                lastWeek={lastWeek}
              />
              <PowerRankings
                columns={powerData?.columns ?? []}
                rows={powerData?.rows ?? []}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
