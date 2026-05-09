import { useMemo } from "react";
import { Avatar } from "../../../components/Avatar";
import {
  useLeagueRosters,
  useLeagueUsers,
  useNFLPlayers,
  usePlayerStats,
} from "../../../hooks/useSleeper";
import { useDashboardData } from "../useDashboardData";
import { SectionHead, teamAvatar, teamName } from "../_shared";

export default function TopPerformersWidget() {
  const { selectedLeagueId, week, season } = useDashboardData();
  const { data: rostersData } = useLeagueRosters(selectedLeagueId);
  const { data: usersData } = useLeagueUsers(selectedLeagueId);
  const { data: players } = useNFLPlayers();
  const { data: playerStats } = usePlayerStats(season, week);

  const rosters = rostersData ?? [];
  const users = usersData ?? [];
  const stats = playerStats as
    | Record<string, Record<string, number>>
    | undefined;

  const top = useMemo(() => {
    if (!stats || !players) return [];

    const playerToRoster = new Map<string, number>();
    for (const r of rosters) {
      for (const pid of r.players ?? []) {
        playerToRoster.set(pid, r.rosterId);
      }
    }

    return Object.entries(stats)
      .filter(([pid]) => !pid.startsWith("TEAM_") && playerToRoster.has(pid))
      .map(([pid, s]) => ({
        playerId: pid,
        name:
          players[pid]?.fullName ??
          (`${players[pid]?.firstName ?? ""} ${players[pid]?.lastName ?? ""}`.trim() ||
            pid),
        position: players[pid]?.position ?? "—",
        pts: Number(s.pts_ppr ?? 0),
        rosterId: playerToRoster.get(pid)!,
      }))
      .filter((p) => p.pts > 0)
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 5);
  }, [stats, players, rosters]);

  if (top.length === 0) return null;

  return (
    <section>
      <SectionHead
        kicker={`Week ${week} · Stars`}
        title="Top Performers"
        rule="Highest fantasy scorers"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 divide-x divide-line">
        {top.map((p, i) => {
          const roster = rosters.find((r) => r.rosterId === p.rosterId)!;
          const tName = teamName(roster, users);
          const tAvatar = teamAvatar(roster, users);
          return (
            <div key={i} className="px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Avatar avatar={tAvatar} name={tName} size={12} />
                <span className="text-[9px] font-semibold tracking-wider uppercase text-muted font-sans truncate">
                  {tName}
                </span>
              </div>
              <div className="font-serif font-bold text-[15px] text-ink leading-tight">
                {p.name}
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-lg text-accent tabular-nums">
                  {p.pts.toFixed(1)}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-muted font-sans">
                  {p.position} · pts
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
