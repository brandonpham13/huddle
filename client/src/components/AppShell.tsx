import { type ReactNode } from "react";
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-xl font-bold text-gray-900">
            Huddle
          </Link>

          {/* League switcher */}
          {syncedLeagues.length > 0 && (
            <div className="flex items-center gap-1 border rounded-lg p-1 bg-gray-50">
              {syncedLeagues.map((league) => (
                <button
                  key={league.ref.leagueId}
                  onClick={() => {
                    dispatch(setSelectedLeague(league.ref.leagueId));
                    dispatch(setSelectedYear(league.season));
                  }}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                    selectedLeagueId === league.ref.leagueId
                      ? "bg-white shadow text-gray-900"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {league.name}
                </button>
              ))}
            </div>
          )}

          {syncedLeagues.length === 0 && (
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
