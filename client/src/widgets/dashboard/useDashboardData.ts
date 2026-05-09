import { useMemo } from "react";
import { useAppSelector } from "../../store/hooks";
import {
  useAllSleeperLeagues,
  useLeague,
  useNFLState,
} from "../../hooks/useSleeper";
import { useMyClaimedTeam } from "../../hooks/useMyClaimedTeam";
import { getFamilySeasons } from "../../utils/leagueFamily";

/**
 * Shared dashboard-level data each widget can pull from. All hooks are
 * deduped by TanStack Query / Redux so calling this in multiple widgets
 * doesn't trigger duplicate fetches.
 */
export function useDashboardData() {
  const syncedLeagueIds = useAppSelector(
    (s) => s.auth.user?.syncedLeagueIds ?? [],
  );
  const selectedLeagueId = useAppSelector((s) => s.auth.selectedLeagueId);
  const { data: allLeagues } = useAllSleeperLeagues();
  const { data: selectedLeague } = useLeague(selectedLeagueId);
  const { data: nflState } = useNFLState();

  const week = nflState?.display_week ?? nflState?.week ?? 1;
  const season = nflState?.season ?? selectedLeague?.season ?? "2024";
  const nextWeek = week < 18 ? week + 1 : week;

  const familySeasons = useMemo(
    () =>
      selectedLeagueId && allLeagues
        ? getFamilySeasons(selectedLeagueId, allLeagues)
        : [],
    [selectedLeagueId, allLeagues],
  );
  const oldestYear =
    familySeasons.at(-1)?.season ?? selectedLeague?.season ?? null;
  const currentFamilyLeagueId =
    familySeasons[0]?.ref.leagueId ?? selectedLeagueId;
  const { rosterId: myRosterId } = useMyClaimedTeam(currentFamilyLeagueId);

  const syncedLeagues =
    allLeagues?.filter((l) => syncedLeagueIds.includes(l.ref.leagueId)) ?? [];
  const hasLeague = !!selectedLeagueId && syncedLeagues.length > 0;

  return {
    selectedLeagueId,
    selectedLeague,
    week,
    season,
    nextWeek,
    currentFamilyLeagueId,
    myRosterId,
    oldestYear,
    hasLeague,
  };
}
