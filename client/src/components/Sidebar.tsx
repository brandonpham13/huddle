import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Trophy,
  Calendar,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Users,
  X,
} from "lucide-react";
import { useAppSelector } from "../store/hooks";
import { useLeagueRosters, useLeagueUsers } from "../hooks/useSleeper";
import { useMyClaimedTeam } from "../hooks/useMyClaimedTeam";
import { useAllSleeperLeagues } from "../hooks/useSleeper";
import { getFamilySeasons } from "../utils/leagueFamily";
import { useMemo } from "react";

const TOP_NAV_ITEMS = [
  { label: "Home", to: "/", icon: Home, end: true },
  { label: "League", to: "/league", icon: Trophy, end: false },
  { label: "Schedule", to: "/schedule", icon: Calendar, end: false },
  { label: "Draft", to: "/draft", icon: ClipboardList, end: false },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onOpenAccount?: () => void;
}

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
  onOpenAccount,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(true);

  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );
  const { data: allLeagues } = useAllSleeperLeagues();

  // Always use the most recent family season for claim lookup (mirrors DashboardPage)
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

  const teams = useMemo(() => {
    if (!rosters) return [];
    return [...rosters]
      .sort((a, b) => {
        // Pin the user's claimed team to the top of the Teams list — it's the
        // one they navigate to most often. Everything else falls back to the
        // numeric rosterId order Sleeper assigns.
        if (a.rosterId === myRosterId) return -1;
        if (b.rosterId === myRosterId) return 1;
        return a.rosterId - b.rosterId;
      })
      .map((r) => {
        const user = r.ownerId
          ? leagueUsers?.find((u) => u.userId === r.ownerId)
          : null;
        const name =
          user?.teamName ?? user?.displayName ?? `Team ${r.rosterId}`;
        const avatar = user?.avatar ?? null;
        const isMine = r.rosterId === myRosterId;
        return { rosterId: r.rosterId, name, avatar, isMine };
      });
  }, [rosters, leagueUsers, myRosterId]);

  // The desktop "collapsed" state hides labels to save horizontal space, but
  // when the same component is rendered as the mobile drawer there's plenty
  // of width — force the expanded look so the user isn't staring at icon-only
  // nav inside the drawer.
  const renderCollapsed = collapsed && !mobileOpen;
  // Drawer is always 16rem wide; the desktop layout collapses between 14 and
  // 52 px depending on user preference.
  const widthClass = collapsed ? "w-64 md:w-14" : "w-64 md:w-52";

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onMobileClose}
        className={`md:hidden fixed inset-0 bg-black/40 z-40 transition-opacity ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      <aside
        className={`
          flex flex-col bg-chrome border-r border-line shrink-0 transition-transform duration-200
          fixed inset-y-0 left-0 z-50
          md:static md:translate-x-0 md:transition-all
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${widthClass}
        `}
      >
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="md:hidden absolute right-2 top-2 p-1.5 text-muted hover:text-ink"
          aria-label="Close navigation menu"
        >
          <X size={18} />
        </button>

        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden md:flex absolute -right-3 top-6 z-10 items-center justify-center w-6 h-6 rounded-full bg-chrome border border-line text-muted hover:text-ink hover:border-ink/30 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        <nav className="flex flex-col gap-1 p-2 mt-8 md:mt-2">
          {TOP_NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${
                isActive
                  ? "bg-highlight text-ink"
                  : "text-muted hover:bg-highlight hover:text-ink"
              }
              ${renderCollapsed ? "justify-center" : ""}
              `
              }
            >
              <Icon size={16} className="shrink-0" />
              {!renderCollapsed && <span>{label}</span>}
            </NavLink>
          ))}

          {/* Teams collapsible */}
          {selectedLeagueId && (
            <div className="mt-1">
              <button
                onClick={() => !renderCollapsed && setTeamsOpen((o) => !o)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-highlight hover:text-ink transition-colors ${renderCollapsed ? "justify-center" : "justify-between"}`}
              >
                <div className="flex items-center gap-3">
                  <Users size={16} className="shrink-0" />
                  {!renderCollapsed && <span>Teams</span>}
                </div>
                {!renderCollapsed &&
                  (teamsOpen ? (
                    <ChevronUp size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  ))}
              </button>

              {!renderCollapsed && teamsOpen && (
                <div className="mt-0.5 ml-2 flex flex-col gap-0.5">
                  {teams.map((team) => (
                    <NavLink
                      key={team.rosterId}
                      to={`/teams/${team.rosterId}`}
                      className={({ isActive }) =>
                        `flex items-center gap-2 pl-5 pr-2 py-1.5 rounded-md text-xs transition-colors truncate
                      ${
                        isActive
                          ? "bg-highlight text-ink"
                          : "text-muted hover:bg-highlight hover:text-ink"
                      }
                      ${team.isMine ? "font-semibold text-ink" : "font-normal"}
                      `
                      }
                    >
                      {team.avatar ? (
                        <img
                          src={`https://sleepercdn.com/avatars/thumbs/${team.avatar}`}
                          alt={team.name}
                          className="w-4 h-4 rounded-full shrink-0 object-cover"
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-line shrink-0" />
                      )}
                      <span className="truncate">{team.name}</span>
                    </NavLink>
                  ))}
                  {teams.length === 0 && (
                    <p className="pl-5 py-1 text-xs text-muted">Loading…</p>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Mobile-only secondary actions (mirror items hidden from top nav at sm) */}
        <div className="md:hidden mt-auto p-2 border-t border-line flex flex-col gap-1">
          <NavLink
            to="/leagues"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-highlight hover:text-ink transition-colors"
          >
            Leagues
          </NavLink>
          {onOpenAccount && (
            <button
              onClick={() => {
                onOpenAccount();
                onMobileClose?.();
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-highlight hover:text-ink transition-colors text-left"
            >
              Account
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
