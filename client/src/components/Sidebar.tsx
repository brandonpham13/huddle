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
        relative flex flex-col bg-white border-r shrink-0 transition-all duration-200
        ${collapsed ? "w-14" : "w-52"}
      `}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-6 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border text-gray-400 hover:text-gray-700 hover:border-gray-400 transition-colors"
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
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
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
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors ${collapsed ? "justify-center" : "justify-between"}`}
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
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                      }
                      ${team.isMine ? "font-semibold text-gray-900" : "font-normal"}
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
                      <div className="w-4 h-4 rounded-full bg-gray-200 shrink-0" />
                    )}
                    <span className="truncate">{team.name}</span>
                  </NavLink>
                ))}
                {teams.length === 0 && (
                  <p className="pl-5 py-1 text-xs text-gray-400">Loading…</p>
                )}
              </div>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
