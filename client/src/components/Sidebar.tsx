import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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

export function Sidebar() {
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
        // Claimed team first
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

  return (
    <aside
      className={`
        relative flex flex-col bg-chrome border-r border-line shrink-0 transition-all duration-200
        ${collapsed ? "w-14" : "w-52"}
      `}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-6 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-chrome border border-line text-muted hover:text-ink hover:border-ink/30 transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <nav className="flex flex-col gap-1 p-2 mt-2">
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
              ${collapsed ? "justify-center" : ""}
              `
            }
          >
            <Icon size={16} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {/* Teams collapsible */}
        {selectedLeagueId && (
          <div className="mt-1">
            <button
              onClick={() => !collapsed && setTeamsOpen((o) => !o)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-highlight hover:text-ink transition-colors ${collapsed ? "justify-center" : "justify-between"}`}
            >
              <div className="flex items-center gap-3">
                <Users size={16} className="shrink-0" />
                {!collapsed && <span>Teams</span>}
              </div>
              {!collapsed &&
                (teamsOpen ? (
                  <ChevronUp size={12} />
                ) : (
                  <ChevronDown size={12} />
                ))}
            </button>

            {!collapsed && teamsOpen && (
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
    </aside>
  );
}
