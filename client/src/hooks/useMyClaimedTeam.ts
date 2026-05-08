import { useGroupsForLeague, useGroupDetail } from "./useGroups";
import { useLeagueRosters, useLeagueUsers } from "./useSleeper";

/**
 * Returns the team name and avatar the current user has an approved claim on
 * within the first group for the selected league. Returns null if the user
 * has no approved claim.
 */
export function useMyClaimedTeam(leagueId: string | null): {
  teamName: string | null;
  avatar: string | null;
  rosterId: number | null;
  isLoading: boolean;
} {
  const { data: groups, isLoading: groupsLoading } = useGroupsForLeague(
    "sleeper",
    leagueId,
  );

  // Use the first group — most leagues will only have one
  const firstGroupId = groups?.[0]?.id ?? null;

  const { data: groupDetail, isLoading: detailLoading } =
    useGroupDetail(firstGroupId);

  const { data: rosters, isLoading: rostersLoading } =
    useLeagueRosters(leagueId);
  const { data: users, isLoading: usersLoading } = useLeagueUsers(leagueId);

  const isLoading =
    groupsLoading || detailLoading || rostersLoading || usersLoading;

  const myClaim = groupDetail?.myClaim;
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
