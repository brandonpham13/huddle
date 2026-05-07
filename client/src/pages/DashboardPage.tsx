import { Suspense, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setSelectedLeague, setSelectedYear } from "../store/slices/authSlice";
import {
  getDashboardWidgets,
  colSpanClass,
  rowSpanClass,
} from "../widgets/registry";
import { useAllSleeperLeagues, useLeague } from "../hooks/useSleeper";
import { getFamilySeasons } from "../utils/leagueFamily";
import { Card, CardContent } from "../components/ui/card";

// Register widgets
import "../widgets/LeagueStandings";
import "../widgets/RecentScoreboard";

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const syncedLeagueIds = useAppSelector(
    (state) => state.auth.user?.syncedLeagueIds ?? [],
  );
  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );

  const dashboardWidgets = getDashboardWidgets();

  const { data: allLeagues } = useAllSleeperLeagues();
  const syncedLeagues =
    allLeagues?.filter((l) => syncedLeagueIds.includes(l.ref.leagueId)) ?? [];
  const { data: selectedLeague } = useLeague(selectedLeagueId);

  const familySeasons = useMemo(
    () =>
      selectedLeagueId && allLeagues
        ? getFamilySeasons(selectedLeagueId, allLeagues)
        : [],
    [selectedLeagueId, allLeagues],
  );

  return (
    <div className="p-6">
      {/* Context bar */}
      {selectedLeague && (
        <div className="mb-4 flex items-center gap-2">
          {selectedLeague.avatar && (
            <img
              src={`https://sleepercdn.com/avatars/thumbs/${selectedLeague.avatar}`}
              alt={selectedLeague.name}
              className="w-6 h-6 rounded-full"
            />
          )}
          <span className="text-sm font-medium text-gray-700">
            {selectedLeague.name}
          </span>
          <span className="text-xs text-gray-400">
            · {selectedLeague.totalRosters} teams
          </span>
          {familySeasons.length > 1 && (
            <select
              value={selectedLeague.season}
              onChange={(e) => {
                const entry = familySeasons.find(
                  (l) => l.season === e.target.value,
                );
                if (entry) {
                  dispatch(setSelectedLeague(entry.ref.leagueId));
                  dispatch(setSelectedYear(entry.season));
                }
              }}
              className="ml-1 text-xs border rounded-md px-2 py-0.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {familySeasons.map((l) => (
                <option key={l.ref.leagueId} value={l.season}>
                  {l.season}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {!selectedLeagueId && syncedLeagues.length > 0 && (
        <div className="text-center text-gray-400 py-20">
          Select a league above to view your dashboard.
        </div>
      )}

      {!selectedLeagueId && syncedLeagues.length === 0 && (
        <div className="text-center text-gray-400 py-20">
          <Link to="/leagues" className="text-blue-600 hover:underline">
            Sync a league
          </Link>{" "}
          to get started.
        </div>
      )}

      {selectedLeagueId && (
        <div className="grid grid-cols-12 gap-4 auto-rows-auto">
          {dashboardWidgets.map((def) => {
            const WidgetComponent = def.component;
            return (
              <div
                key={def.id}
                className={`${colSpanClass(def.defaultSize.w)} ${rowSpanClass(def.defaultSize.h)}`}
              >
                <Suspense
                  fallback={
                    <Card>
                      <CardContent className="p-8 flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
                      </CardContent>
                    </Card>
                  }
                >
                  <WidgetComponent />
                </Suspense>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
