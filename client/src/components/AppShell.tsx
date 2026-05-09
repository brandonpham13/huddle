import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useSignOut } from "../hooks/useSignOut";
import { useAccountModal } from "./AccountModal";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setSelectedLeague, setSelectedYear } from "../store/slices/authSlice";
import { useAllSleeperLeagues } from "../hooks/useSleeper";
import { useMyClaimedTeam } from "../hooks/useMyClaimedTeam";
import { getFamilySeasons } from "../utils/leagueFamily";
import { Button } from "./ui/button";
import { Sidebar } from "./Sidebar";
import { Avatar } from "./Avatar";
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

  // The actual selected league entry (may be an older season not in uniqueLeagues).
  const selectedLeague = allLeagues?.find(
    (l) => l.ref.leagueId === selectedLeagueId,
  );

  const familySeasons = useMemo(
    () =>
      selectedLeagueId && allLeagues
        ? getFamilySeasons(selectedLeagueId, allLeagues)
        : [],
    [selectedLeagueId, allLeagues],
  );
  const currentFamilyLeagueId =
    familySeasons[0]?.ref.leagueId ?? selectedLeagueId;

  // For the league dropdown, find the family-representative entry that exists in
  // uniqueLeagues (deduped by name). When an older season is selected the raw
  // selectedLeagueId may not be in uniqueLeagues, so match by name instead.
  const selectedLeagueRep = selectedLeague
    ? uniqueLeagues.find((l) => l.name === selectedLeague.name)
    : undefined;
  const { teamName: claimedTeamName, avatar: claimedAvatar } = useMyClaimedTeam(
    currentFamilyLeagueId,
  );

  const handleSeasonChange = (season: string) => {
    const entry = familySeasons.find((l) => l.season === season);
    if (entry) {
      dispatch(setSelectedLeague(entry.ref.leagueId));
      dispatch(setSelectedYear(entry.season));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      {/* Top nav */}
      <nav className="bg-chrome border-b border-line px-3 sm:px-7 py-2 flex items-center justify-between gap-2 shrink-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 font-mono text-[10px] text-muted tracking-wider uppercase">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden -ml-1 p-1.5 text-muted hover:text-ink transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          <Link
            to="/"
            className="font-serif italic text-ink text-xl sm:text-2xl font-bold tracking-tight normal-case shrink-0"
          >
            Huddle
          </Link>

          {uniqueLeagues.length > 0 && selectedLeagueRep && (
            <>
              <span className="hidden sm:inline">·</span>
              <select
                value={selectedLeagueRep.ref.leagueId}
                onChange={(e) => handleLeagueChange(e.target.value)}
                aria-label="Select league"
                className="bg-transparent border-none outline-none text-[10px] font-mono text-muted tracking-wider uppercase cursor-pointer hover:text-ink transition-colors min-w-0 max-w-[40vw] sm:max-w-none truncate"
              >
                {uniqueLeagues.map((league) => (
                  <option key={league.ref.leagueId} value={league.ref.leagueId}>
                    {league.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {familySeasons.length > 1 && selectedLeague && (
            <>
              <span>·</span>
              <select
                value={selectedLeague.season}
                onChange={(e) => handleSeasonChange(e.target.value)}
                aria-label="Select season"
                className="bg-transparent border-none outline-none text-[10px] font-mono text-muted tracking-wider uppercase cursor-pointer hover:text-ink transition-colors"
              >
                {familySeasons.map((l) => (
                  <option key={l.ref.leagueId} value={l.season}>
                    {l.season}
                  </option>
                ))}
              </select>
            </>
          )}

          {uniqueLeagues.length === 0 && (
            <Link
              to="/leagues"
              className="text-[10px] text-accent hover:underline truncate normal-case font-sans tracking-normal"
            >
              Sync a league to get started
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {claimedTeamName && (
            <div
              className="flex items-center gap-1.5 font-mono text-[10px] text-accent tracking-wider uppercase font-semibold min-w-0 max-w-[24ch]"
              title={`Your team: ${claimedTeamName}`}
            >
              <Avatar avatar={claimedAvatar} name={claimedTeamName} size={16} />
              <span className="hidden sm:inline truncate">
                ★ {claimedTeamName}
              </span>
            </div>
          )}
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
