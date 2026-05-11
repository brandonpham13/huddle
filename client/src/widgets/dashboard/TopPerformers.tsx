/**
 * TopPerformers — the "Stars" strip showing the week's highest-scoring
 * rostered players across the league.
 *
 * Default view ("ALL") shows the top 5 scorers across all positions.
 * The position selector lets users filter to QB, RB, WR, TE, DEF, or K —
 * each showing the top 5 for that position.
 *
 * DEF entries are keyed like "TEAM_BUF" in Sleeper's stat dump. For the
 * ALL / individual-position views we drop them; when the user selects "DEF"
 * we flip the filter to include only those entries and resolve the team name
 * from the player ID (e.g. "TEAM_BUF" → "BUF").
 *
 * Data inputs (from DashboardPage):
 *   - `playerStats`: Sleeper's per-player stat dump for `(season, week)`,
 *     keyed by player_id.
 *   - `players`: the global NFL player dictionary, used to resolve names
 *     and positions from the stat-line player_id.
 *   - `rosters`: the league's rosters, used to label each card with the
 *     owning team name/avatar.
 *
 * The section collapses to nothing when no player scored > 0 (preseason, an
 * unscored week, etc.) — handled by `if (top.length === 0) return null`.
 *
 * Mobile: `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` so the strip wraps
 * onto multiple rows on small screens instead of overflowing.
 */
import { useMemo, useState } from "react";
import { Avatar } from "../../components/Avatar";
import type { Roster, TeamUser } from "../../types/fantasy";
import { SectionHead, teamAvatar, teamName } from "./_shared";

// Positions available in the selector. "ALL" is the default view.
const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "DEF", "K"] as const;
type Position = (typeof POSITIONS)[number];

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
  const [selectedPos, setSelectedPos] = useState<Position>("ALL");

  // Reverse-index rosters once so per-player lookup is O(1).
  const playerToRoster = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rosters) {
      for (const pid of r.players ?? []) {
        map.set(pid, r.rosterId);
      }
    }
    return map;
  }, [rosters]);

  const top = useMemo(() => {
    if (!playerStats || !players) return [];

    return (
      Object.entries(playerStats)
        .filter(([pid]) => {
          const isDef = pid.startsWith("TEAM_");
          // DEF tab: only team-defense entries that are rostered.
          if (selectedPos === "DEF") return isDef && playerToRoster.has(pid);
          // ALL tab: individual players only (no team defenses), must be rostered.
          if (selectedPos === "ALL")
            return !isDef && playerToRoster.has(pid);
          // Position tab: match position and must be rostered.
          return (
            !isDef &&
            playerToRoster.has(pid) &&
            players[pid]?.position === selectedPos
          );
        })
        .map(([pid, stats]) => {
          const isDef = pid.startsWith("TEAM_");
          // For DEF entries the player dictionary won't have a record —
          // derive a display name from the key (e.g. "TEAM_BUF" → "BUF DEF").
          const name = isDef
            ? `${pid.replace("TEAM_", "")} DEF`
            : (players[pid]?.fullName ??
              (`${players[pid]?.firstName ?? ""} ${players[pid]?.lastName ?? ""}`.trim() ||
              pid));
          const position = isDef ? "DEF" : (players[pid]?.position ?? "—");
          return {
            playerId: pid,
            name,
            position,
            pts: Number(stats.pts_ppr ?? 0),
            rosterId: playerToRoster.get(pid)!,
          };
        })
        .filter((p) => p.pts > 0)
        .sort((a, b) => b.pts - a.pts)
        .slice(0, 5)
    );
  }, [playerStats, players, playerToRoster, selectedPos]);

  if (!playerStats || !players) return null;
  if (top.length === 0 && selectedPos === "ALL") return null;

  return (
    <section>
      <SectionHead
        kicker={`Week ${week} · Stars`}
        title="Top Performers"
        rule="Highest fantasy scorers"
      />

      {/* Position selector */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            onClick={() => setSelectedPos(pos)}
            className={`px-2 py-0.5 text-[9.5px] font-semibold tracking-wider uppercase font-sans rounded transition-colors ${
              selectedPos === pos
                ? "bg-accent text-white"
                : "bg-black/5 dark:bg-white/10 text-muted hover:bg-black/10 dark:hover:bg-white/15"
            }`}
          >
            {pos}
          </button>
        ))}
      </div>

      {top.length === 0 ? (
        <p className="text-[11px] text-muted font-sans py-2">
          No scored players for this position yet.
        </p>
      ) : (
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
      )}
    </section>
  );
}
