import { useHuddlesForLeague, useHuddleDetail } from "./useHuddles";
import { useLeagueRosters, useLeagueUsers } from "./useSleeper";

/**
 * Returns the team name + avatar that the current user has an *approved*
 * claim on for the given league.
 *
 * "Claim" is Huddle's concept of "this user owns this roster slot for this
 * group of friends" — it's how we know which Sleeper roster belongs to
 * the signed-in user without making them re-enter their team every season.
 *
 * Wiring (4 dependent queries combined):
 *   1. `useHuddlesForLeague` → which huddles exist for this league
 *   2. `useHuddleDetail`     → the user's claim within the first huddle
 *   3. `useLeagueRosters`    → look up the roster matching the claim
 *   4. `useLeagueUsers`      → resolve display name + avatar
 *
 * Returns `null` everywhere when there's no approved claim. Callers can
 * use `isLoading` to distinguish "we don't know yet" from "definitely no
 * claim".
 *
 * Important: pass the **newest** family leagueId (not whichever season the
 * user happens to be viewing). Claims live against the newest season, so
 * looking them up against an older season would always return null.
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
