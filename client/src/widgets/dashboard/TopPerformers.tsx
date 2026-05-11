/**
 * TopPerformers — the "Stars" strip showing the week's 5 highest-scoring
 * rostered players across the league.
 *
 * Data inputs (from DashboardPage):
 *   - `playerStats`: Sleeper's per-player stat dump for `(season, week)`,
 *     keyed by player_id. Contains both individual players (NFL ID strings)
 *     and team defense entries ("TEAM_BUF"); we filter the latter out.
 *   - `players`: the global NFL player dictionary, used to resolve names
 *     and positions from the stat-line player_id.
 *   - `rosters`: the league's rosters, used to figure out which roster owns
 *     each player so we can label the strip with the team name.
 *
 * The list collapses to nothing when no player scored > 0 (preseason, an
 * unscored week, etc.) — handled by the `if (top.length === 0) return null`.
 *
 * Mobile: `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` so the strip wraps
 * onto multiple rows on small screens instead of overflowing.
 */
import { useMemo } from "react";
import { Avatar } from "../../components/Avatar";
import type { Roster, TeamUser } from "../../types/fantasy";
import { SectionHead, teamAvatar, teamName } from "./_shared";

export function TopPerformers({
  rosters,
  users,
  playerStats,
  players,
  week,
}: {
  rosters: Roster[];
  users: TeamUser[];
  playerStats: Record<string, Record<string, number>> | undefined;
  players:
    | Record<
        string,
        {
          fullName?: string;
          firstName: string;
          lastName: string;
          position: string;
        }
      >
    | undefined;
  week: number;
}) {
  const top = useMemo(() => {
    if (!playerStats || !players) return [];

    // Reverse-index Sleeper's per-roster `players` arrays so we can answer
    // "which roster owns this player?" in O(1) while filtering stats.
    const playerToRoster = new Map<string, number>();
    for (const r of rosters) {
      for (const pid of r.players ?? []) {
        playerToRoster.set(pid, r.rosterId);
      }
    }

    return (
      Object.entries(playerStats)
        // Sleeper mixes in defense entries keyed like "TEAM_BUF". Drop them
        // so the leaderboard only shows individual players, and skip anyone
        // not currently rostered in this league.
        .filter(([pid]) => !pid.startsWith("TEAM_") && playerToRoster.has(pid))
        .map(([pid, stats]) => ({
          playerId: pid,
          name:
            players[pid]?.fullName ??
            (`${players[pid]?.firstName ?? ""} ${players[pid]?.lastName ?? ""}`.trim() ||
              pid),
          position: players[pid]?.position ?? "—",
          pts: Number(stats.pts_ppr ?? 0),
          rosterId: playerToRoster.get(pid)!,
        }))
        .filter((p) => p.pts > 0)
        .sort((a, b) => b.pts - a.pts)
        .slice(0, 5)
    );
  }, [playerStats, players, rosters]);

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
          const roster = rosters.find((r) => r.rosterId === p.rosterId);
          if (!roster) return null;
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
