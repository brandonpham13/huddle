import { type ReactNode, useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import { useSignOut } from "../hooks/useSignOut";
import { useAccountModal } from "./AccountModal";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setSelectedLeague, setSelectedYear } from "../store/slices/authSlice";
import { useAllSleeperLeagues } from "../hooks/useSleeper";
import { Button } from "./ui/button";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  /** Pass children when not using React Router's <Outlet /> */
  children?: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const dispatch = useAppDispatch();
  const { signOut } = useSignOut();
  const { open: openAccountModal } = useAccountModal();

  const syncedLeagueIds = useAppSelector(
    (state) => state.auth.user?.syncedLeagueIds ?? [],
  );
  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );
  const { data: allLeagues } = useAllSleeperLeagues();
  const syncedLeagues =
    allLeagues?.filter((l) => syncedLeagueIds.includes(l.ref.leagueId)) ?? [];

  // One entry per league family (deduplicated by name, keeping most recent season
  // since Sleeper returns newest first). The in-page season selector handles year nav.
  const uniqueLeagues = syncedLeagues.filter(
    (l, i, arr) => arr.findIndex((x) => x.name === l.name) === i,
  );

  // Auto-select the first league once leagues load and nothing is selected yet
  useEffect(() => {
    if (!selectedLeagueId && uniqueLeagues.length > 0) {
      const first = uniqueLeagues[0]!;
      dispatch(setSelectedLeague(first.ref.leagueId));
      dispatch(setSelectedYear(first.season));
    }
  }, [uniqueLeagues, selectedLeagueId, dispatch]);

  const handleLeagueChange = (leagueId: string) => {
    const league = uniqueLeagues.find((l) => l.ref.leagueId === leagueId);
    if (league) {
      dispatch(setSelectedLeague(league.ref.leagueId));
      dispatch(setSelectedYear(league.season));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-xl font-bold text-gray-900">
            Huddle
          </Link>

          {/* League dropdown */}
          {uniqueLeagues.length > 0 && (
            <select
              value={selectedLeagueId ?? ""}
              onChange={(e) => handleLeagueChange(e.target.value)}
              className="text-sm border rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <optgroup label="Sleeper">
                {uniqueLeagues.map((league) => (
                  <option key={league.ref.leagueId} value={league.ref.leagueId}>
                    {league.name}
                  </option>
                ))}
              </optgroup>
            </select>
          )}

          {uniqueLeagues.length === 0 && (
            <Link
              to="/leagues"
              className="text-sm text-blue-600 hover:underline"
            >
              Sync a league to get started
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/widgets"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Widgets
          </Link>
          <Link
            to="/leagues"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Leagues
          </Link>
          <button
            onClick={openAccountModal}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Account
          </button>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </nav>

      {/* Body: sidebar + page content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
