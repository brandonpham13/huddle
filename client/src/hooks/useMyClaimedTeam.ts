import { useHuddlesForLeague, useHuddleDetail } from "./useHuddles";
import { useLeagueRosters, useLeagueUsers } from "./useSleeper";

/**
 * Returns the team name and avatar the current user has an approved claim on
 * within the first huddle for the selected league. Returns null if the user
 * has no approved claim.
 */
export function useMyClaimedTeam(leagueId: string | null): {
  teamName: string | null;
  avatar: string | null;
  rosterId: number | null;
  isLoading: boolean;
} {
  const { data: huddles, isLoading: huddlesLoading } = useHuddlesForLeague(
    "sleeper",
    leagueId,
  );

  // Use the first huddle — most leagues will only have one
  const firstHuddleId = huddles?.[0]?.id ?? null;

  const { data: huddleDetail, isLoading: detailLoading } =
    useHuddleDetail(firstHuddleId);

  const { data: rosters, isLoading: rostersLoading } =
    useLeagueRosters(leagueId);
  const { data: users, isLoading: usersLoading } = useLeagueUsers(leagueId);

  const isLoading =
    huddlesLoading || detailLoading || rostersLoading || usersLoading;

  const myClaim = huddleDetail?.myClaim;
  if (!myClaim || myClaim.status !== "approved") {
    return { teamName: null, avatar: null, rosterId: null, isLoading };
  }

  const roster = rosters?.find((r) => r.rosterId === myClaim.rosterId) ?? null;
  const user = roster?.ownerId
    ? users?.find((u) => u.userId === roster.ownerId)
    : null;

  const teamName =
    user?.teamName ?? user?.displayName ?? `Team ${myClaim.rosterId}`;
  const avatar = user?.avatar ?? null;

  return { teamName, avatar, rosterId: myClaim.rosterId, isLoading };
}
