/**
 * TopPerformers — the "Stars" strip showing the week's highest-scoring
 * rostered players across the league.
 *
 * Default view ("ALL") shows the top 5 scorers across all positions.
 * The position selector lets users filter to QB, RB, WR, TE, DEF, or K.
 *
 * DEF scoring quirk:
 *   Sleeper's bulk stats endpoint returns cumulative season totals for TEAM_
 *   entries, not per-week scores. Per-week DEF points live in the matchup
 *   data as `playersPoints[numericDefPlayerId]`. The DEF tab sources its
 *   points from `matchups` rather than `playerStats` for this reason.
 *
 * Data inputs (from DashboardPage):
 *   - `playerStats`: Sleeper's per-player stat dump for (season, week).
 *   - `matchups`: This week's matchup entries, used for per-week DEF scoring.
 *   - `players`: The global NFL player dictionary.
 *   - `rosters`: League rosters, used to label cards with team name/avatar.
 */
import { useMemo, useState } from "react";
import { Avatar } from "../../components/Avatar";
import type { Matchup, Roster, TeamUser } from "../../types/fantasy";
import type { Player } from "../../types/fantasy";
import {
  buildDefStatsKeyMap,
  buildDefWeeklyPointsMap,
  getFantasyPoints,
} from "../../utils/sleeperNormalize";
import { SectionHead, teamAvatar, teamName } from "./_shared";

// Positions available in the selector. "ALL" is the default view.
const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "DEF", "K"] as const;
type Position = (typeof POSITIONS)[number];

export function TopPerformers({
  rosters,
  users,
  playerStats,
  matchups,
  players,
  week,
}: {
  rosters: Roster[];
  users: TeamUser[];
  playerStats: Record<string, Record<string, number>> | undefined;
  matchups: Matchup[] | undefined;
  players: Record<string, Player> | undefined;
  week: number;
}) {
  const [selectedPos, setSelectedPos] = useState<Position>("ALL");

  // Normal player → roster map.
  const playerToRoster = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rosters) {
      for (const pid of r.players ?? []) map.set(pid, r.rosterId);
    }
    return map;
  }, [rosters]);

  // DEF → roster map: Sleeper keys team defenses as "TEAM_BUF" in the stats
  // endpoint but stores them by numeric ID in rosters.
  const defTeamToRoster = useMemo(
    () => buildDefStatsKeyMap(rosters, players),
    [rosters, players],
  );

  // DEF → weekly fantasy points map, sourced from matchup playersPoints
  // rather than the bulk stats endpoint (which returns season totals for DEFs).
  const defWeeklyPoints = useMemo(
    () => buildDefWeeklyPointsMap(matchups ?? [], players, rosters),
    [matchups, players, rosters],
  );

  const top = useMemo(() => {
    if (!playerStats || !players) return [];

    if (selectedPos === "DEF") {
      // Source DEF points from matchup data, not playerStats.
      return Array.from(defTeamToRoster.entries())
        .map(([teamKey, rosterId]) => ({
          playerId: teamKey,
          name: `${teamKey.replace("TEAM_", "")} DEF`,
          position: "DEF" as const,
          pts: defWeeklyPoints.get(teamKey) ?? 0,
          rosterId,
        }))
        .filter((p) => p.pts > 0)
        .sort((a, b) => b.pts - a.pts)
        .slice(0, 5);
    }

    return (
      Object.entries(playerStats)
        .filter(([pid]) => {
          const isDef = pid.startsWith("TEAM_");
          if (selectedPos === "ALL") return !isDef && playerToRoster.has(pid);
          return (
            !isDef &&
            playerToRoster.has(pid) &&
            players[pid]?.position === selectedPos
          );
        })
        .map(([pid, stats]) => ({
          playerId: pid,
          name:
            players[pid]?.fullName ??
            (`${players[pid]?.firstName ?? ""} ${players[pid]?.lastName ?? ""}`.trim() || pid),
          position: players[pid]?.position ?? "—",
          pts: getFantasyPoints(stats),
          rosterId: playerToRoster.get(pid)!,
        }))
        .filter((p) => p.pts > 0)
        .sort((a, b) => b.pts - a.pts)
        .slice(0, 5)
    );
  }, [playerStats, players, playerToRoster, defTeamToRoster, defWeeklyPoints, selectedPos]);

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
