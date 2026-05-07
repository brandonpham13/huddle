import { Suspense } from "react";
import { Link } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import {
  getDashboardWidgets,
  colSpanClass,
  rowSpanClass,
} from "../widgets/registry";
import { useAllSleeperLeagues, useLeague } from "../hooks/useSleeper";
import { Card, CardContent } from "../components/ui/card";

// Register widgets
import "../widgets/LeagueStandings";
import "../widgets/RecentScoreboard";

export function DashboardPage() {
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
            · {selectedLeague.totalRosters} teams · {selectedLeague.season}
          </span>
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
