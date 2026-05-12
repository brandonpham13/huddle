/**
 * AppShell — the persistent chrome that wraps every authenticated route.
 *
 * Mounted by `App.tsx` around the `<Outlet />` for the protected routes.
 * Every page (DashboardPage, LeaguesPage, TeamPage, HuddleDetailPage, ...)
 * renders inside this shell, which is responsible for:
 *
 *   - The top nav bar (wordmark + league dropdown + season dropdown +
 *     claimed-team badge + right-side actions).
 *   - The left Sidebar (becomes a slide-in drawer below md).
 *   - The mobile hamburger button + drawer open/close state.
 *
 * The nav adopts the "season bar" newspaper-breadcrumb style (mono
 * uppercase, serif italic wordmark). The league + season dropdowns share
 * styling and both let the user switch context. League selection is
 * persisted to localStorage by the Redux store subscriber (see
 * `store/index.ts`), so refreshing keeps your last view.
 *
 * Two pieces of "domain logic" live here that aren't obvious from a quick
 * read:
 *
 *   1. League dedup by family root. `uniqueLeagues` collapses sibling
 *      seasons of the same league into one entry (the newest), so the
 *      dropdown shows "My League" once instead of one row per year.
 *      Cross-season renames are handled by deduping on family root from
 *      `buildFamilyRootMap`, not on display name.
 *
 *   2. Selecting an older season. The user picks a past season from the
 *      season dropdown — at that point `selectedLeagueId` is *not* in
 *      `uniqueLeagues` (which only has newest entries). We look the
 *      selection up by family root via `selectedLeagueRep` so the league
 *      dropdown still highlights the correct family.
 */
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useSignOut } from "../hooks/useSignOut";
import { useAccountModal } from "./AccountModal";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setSelectedLeague, setSelectedYear } from "../store/slices/authSlice";
import { useAllSleeperLeagues } from "../hooks/useSleeper";
import { useMyClaimedTeam } from "../hooks/useMyClaimedTeam";
import { useMyHuddles } from "../hooks/useHuddles";
import { buildFamilyRootMap, getFamilySeasons } from "../utils/leagueFamily";
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

  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );
  const { data: allLeagues } = useAllSleeperLeagues();
  const { data: myHuddles } = useMyHuddles();

  const familyRootMap = useMemo(
    () => (allLeagues ? buildFamilyRootMap(allLeagues) : null),
    [allLeagues],
  );

  // Leagues available in the sidebar = those linked to any of the user's huddles
  const huddleLeagueIds = useMemo(
    () =>
      [...new Set(
        (myHuddles ?? [])
          .map((h) => h.leagueId)
          .filter((id): id is string => !!id),
      )],
    [myHuddles],
  );

  const syncedLeagues = useMemo(
    () =>
      allLeagues?.filter((l) => huddleLeagueIds.includes(l.ref.leagueId)) ?? [],
    [allLeagues, huddleLeagueIds],
  );

  // One entry per league family, picking the most recent season as the
  // representative (so renames in past seasons don't create duplicate entries).
  const uniqueLeagues = useMemo(() => {
    if (!familyRootMap) return syncedLeagues;
    const sorted = [...syncedLeagues].sort(
      (a, b) => Number(b.season) - Number(a.season),
    );
    const seen = new Set<string>();
    const result: typeof syncedLeagues = [];
    for (const l of sorted) {
      const root = familyRootMap.get(l.ref.leagueId) ?? l.ref.leagueId;
      if (seen.has(root)) continue;
      seen.add(root);
      result.push(l);
    }
    return result;
  }, [syncedLeagues, familyRootMap]);

  // Auto-select on first load when nothing is persisted yet, OR when the
  // previously-selected league is no longer in the available (huddle-linked)
  // list — e.g. the user unlinked it from their huddle.
  useEffect(() => {
    if (!myHuddles) return; // wait until huddles have loaded before clearing
    const allIds = new Set(allLeagues?.map((l) => l.ref.leagueId) ?? []);
    // The selected league must still exist AND be linked to one of the user's huddles
    const selectionValid =
      !!selectedLeagueId &&
      allIds.has(selectedLeagueId) &&
      uniqueLeagues.some(
        (l) =>
          (familyRootMap?.get(l.ref.leagueId) ?? l.ref.leagueId) ===
          (familyRootMap?.get(selectedLeagueId) ?? selectedLeagueId),
      );

    if (!selectionValid && uniqueLeagues.length > 0) {
      const first = uniqueLeagues[0]!;
      dispatch(setSelectedLeague(first.ref.leagueId));
      dispatch(setSelectedYear(first.season));
    } else if (!selectionValid && uniqueLeagues.length === 0) {
      dispatch(setSelectedLeague(null));
    }
  }, [uniqueLeagues, selectedLeagueId, myHuddles, allLeagues, familyRootMap, dispatch]);

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

  // The league dropdown shows one entry per family (latest season's name).
  // Match by family root so older-season selections still resolve, even when
  // the league was renamed between seasons.
  const selectedRoot =
    selectedLeagueId && familyRootMap
      ? (familyRootMap.get(selectedLeagueId) ?? selectedLeagueId)
      : null;
  const selectedLeagueRep = selectedRoot
    ? uniqueLeagues.find(
        (l) =>
          (familyRootMap?.get(l.ref.leagueId) ?? l.ref.leagueId) ===
          selectedRoot,
      )
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
            className="font-serif italic text-ink text-xl sm:text-2xl font-bold tracking-tight normal-case shrink-0 translate-y-[2px]"
          >
            huddle
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
              Create or join a huddle to get started
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
            Huddles
          </Link>
          <button
            onClick={() => openAccountModal()}
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
          onOpenAccount={() => openAccountModal()}
        />
        <main className="flex-1 overflow-auto">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
