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
} from "../hooks/useSleeper";
import { usePowerRankings } from "../hooks/usePowerRankings";
import { getFamilySeasons } from "../utils/leagueFamily";
import { useMyClaimedTeam } from "../hooks/useMyClaimedTeam";
import { Ticker } from "../widgets/dashboard/Ticker";
import { Masthead } from "../widgets/dashboard/Masthead";
import { MyTeamSection } from "../widgets/dashboard/MyTeamSection";
import { TopPerformers } from "../widgets/dashboard/TopPerformers";
import { LeagueTable } from "../widgets/dashboard/LeagueTable";
import { Scoreboard } from "../widgets/dashboard/Scoreboard";
import { PowerRankings } from "../widgets/dashboard/PowerRankings";

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center font-serif italic text-muted text-lg">
        <Link to="/leagues" className="text-accent hover:underline">
          Sync a league
        </Link>{" "}
        to get started.
      </div>
    </div>
  );
}

export function DashboardPage() {
  const syncedLeagueIds = useAppSelector(
    (state) => state.auth.user?.syncedLeagueIds ?? [],
  );
  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );

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

  const { data: rosters } = useLeagueRosters(selectedLeagueId);
  const { data: users } = useLeagueUsers(selectedLeagueId);
  const { data: matchups } = useLeagueMatchups(selectedLeagueId, week);
  const { data: nextMatchups } = useLeagueMatchups(
    selectedLeagueId,
    nextWeek !== week ? nextWeek : 0,
  );
  const { data: playerStats } = usePlayerStats(season, week);
  const { data: powerData } = usePowerRankings(selectedLeagueId);

  const familySeasons = useMemo(
    () =>
      selectedLeagueId && allLeagues
        ? getFamilySeasons(selectedLeagueId, allLeagues)
        : [],
    [selectedLeagueId, allLeagues],
  );

  const oldestYear = useMemo(
    () => familySeasons.at(-1)?.season ?? selectedLeague?.season ?? null,
    [familySeasons, selectedLeague],
  );

  const currentFamilyLeagueId =
    familySeasons[0]?.ref.leagueId ?? selectedLeagueId;
  const { rosterId: myRosterId } = useMyClaimedTeam(currentFamilyLeagueId);

  const syncedLeagues =
    allLeagues?.filter((l) => syncedLeagueIds.includes(l.ref.leagueId)) ?? [];

  const hasLeague = !!selectedLeagueId && syncedLeagues.length > 0;

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
              players={players}
              week={week}
            />

            <div className="h-4" />

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_0.9fr] gap-6">
              <LeagueTable
                rosters={rosters ?? []}
                users={users ?? []}
                myRosterId={myRosterId}
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
