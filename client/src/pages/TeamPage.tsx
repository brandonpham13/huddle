import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import { useLeagueRosters, useLeagueUsers } from "../hooks/useSleeper";
import { useMyClaimedTeam } from "../hooks/useMyClaimedTeam";
import { useAllSleeperLeagues } from "../hooks/useSleeper";
import { getFamilySeasons } from "../utils/leagueFamily";

export function TeamPage() {
  const { rosterId: rosterIdParam } = useParams<{ rosterId: string }>();
  const rosterId = rosterIdParam ? Number(rosterIdParam) : null;

  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );
  const { data: allLeagues } = useAllSleeperLeagues();
  const familySeasons = useMemo(
    () =>
      selectedLeagueId && allLeagues
        ? getFamilySeasons(selectedLeagueId, allLeagues)
        : [],
    [selectedLeagueId, allLeagues],
  );
  const currentFamilyLeagueId =
    familySeasons[0]?.ref.leagueId ?? selectedLeagueId;

  const { data: rosters } = useLeagueRosters(selectedLeagueId);
  const { data: leagueUsers } = useLeagueUsers(selectedLeagueId);
  const { rosterId: myRosterId } = useMyClaimedTeam(currentFamilyLeagueId);

  const roster = rosters?.find((r) => r.rosterId === rosterId) ?? null;
  const user = roster?.ownerId
    ? leagueUsers?.find((u) => u.userId === roster.ownerId)
    : null;

  const teamName =
    user?.teamName ??
    user?.displayName ??
    (roster ? `Team ${roster.rosterId}` : null);
  const avatar = user?.avatar ?? null;
  const isMyTeam = rosterId !== null && rosterId === myRosterId;

  if (!roster) {
    return (
      <div className="p-6 text-gray-500">
        {rosters ? "Team not found." : "Loading…"}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Team header */}
      <div className="flex items-center gap-4">
        {avatar ? (
          <img
            src={`https://sleepercdn.com/avatars/thumbs/${avatar}`}
            alt={teamName ?? ""}
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-lg font-bold">
            {teamName?.charAt(0) ?? "?"}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {teamName}
            {isMyTeam && (
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                Your team
              </span>
            )}
          </h1>
          {user && (
            <p className="text-sm text-gray-500 mt-0.5">{user.displayName}</p>
          )}
        </div>
      </div>

      {/* Placeholder for future widgets */}
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
        Team dashboard — widgets coming soon
      </div>
    </div>
  );
}
