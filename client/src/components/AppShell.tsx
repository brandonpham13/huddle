import { type ReactNode, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useSignOut } from "../hooks/useSignOut";
import { useAccountModal } from "./AccountModal";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setSelectedLeague, setSelectedYear } from "../store/slices/authSlice";
import { useAllSleeperLeagues } from "../hooks/useSleeper";
import { Button } from "./ui/button";
import { Sidebar } from "./Sidebar";
import { useTheme } from "../context/ThemeContext";

interface AppShellProps {
  children?: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const dispatch = useAppDispatch();
  const { signOut } = useSignOut();
  const { open: openAccountModal } = useAccountModal();
  const { theme, toggle } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  // Auto-close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const syncedLeagueIds = useAppSelector(
    (state) => state.auth.user?.syncedLeagueIds ?? [],
  );
  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );
  const { data: allLeagues } = useAllSleeperLeagues();
  const syncedLeagues =
    allLeagues?.filter((l) => syncedLeagueIds.includes(l.ref.leagueId)) ?? [];

  const uniqueLeagues = syncedLeagues.filter(
    (l, i, arr) => arr.findIndex((x) => x.name === l.name) === i,
  );

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
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      {/* Top nav */}
      <nav className="bg-chrome border-b border-line px-3 sm:px-6 py-3 flex items-center justify-between gap-2 shrink-0 z-10">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden -ml-1 p-1.5 text-muted hover:text-ink transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          <Link
            to="/"
            className="text-xl font-bold text-ink font-serif italic shrink-0"
          >
            Huddle
          </Link>

          {uniqueLeagues.length > 0 && (
            <select
              value={selectedLeagueId ?? ""}
              onChange={(e) => handleLeagueChange(e.target.value)}
              className="text-sm border border-line rounded-md px-2 py-1.5 bg-paper text-body focus:outline-none focus:ring-2 focus:ring-accent/40 min-w-0 truncate max-w-[40vw] sm:max-w-none"
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
              className="text-sm text-accent hover:underline truncate"
            >
              Sync a league to get started
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <Link
            to="/leagues"
            className="hidden sm:inline text-sm text-muted hover:text-ink transition-colors"
          >
            Leagues
          </Link>
          <button
            onClick={openAccountModal}
            className="hidden sm:inline text-sm text-muted hover:text-ink transition-colors"
          >
            Account
          </button>
          <button
            onClick={toggle}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-line text-muted hover:text-ink transition-colors text-sm"
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? "☀" : "☽"}
          </button>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </nav>

      {/* Body: sidebar + page content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
          onOpenAccount={openAccountModal}
        />
        <main className="flex-1 overflow-auto">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
