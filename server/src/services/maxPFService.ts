/**
 * maxPFService.ts
 *
 * Computes "Max PF" for every roster in a league — the total points each team
 * would have scored if they had set their optimal lineup every week.
 *
 * Algorithm (per roster, per week):
 *   1. Collect every player on the roster + their actual fantasy points from
 *      `Matchup.playersPoints`.
 *   2. Read the league's `roster_positions` to get the starting-slot list
 *      (e.g. ["QB","WR","WR","RB","RB","TE","FLEX","BN","BN"...]). BN / IR
 *      slots are ignored.
 *   3. Fill slots greedily in specificity order (QB → K → DEF → RB/WR/TE →
 *      FLEX → SUPER_FLEX → REC_FLEX → WRRB_FLEX) so that scarce-position
 *      players are consumed before broad FLEX slots open up.
 *   4. For each slot, pick the highest-scoring unused eligible player.
 *   5. Sum across all scored weeks → per-roster season Max PF.
 *
 * Eligible positions per slot type:
 *   QB         → QB
 *   RB         → RB
 *   WR         → WR
 *   TE         → TE
 *   K          → K
 *   DEF        → DEF
 *   FLEX       → RB, WR, TE
 *   SUPER_FLEX → QB, RB, WR, TE
 *   REC_FLEX   → WR, TE
 *   WRRB_FLEX  → WR, RB
 *   IDP_FLEX   → DB, DL, LB (IDP leagues — treated as unknown, skipped)
 *
 * Ignored slots: BN, IR, IL, IR_TAXI
 */

import type { FantasyProvider } from "../providers/types.js";

// ─── Slot eligibility ─────────────────────────────────────────────────────────

/**
 * Map from Sleeper roster position slot → set of eligible player positions.
 * "FLEX" means the standard RB/WR/TE flex.
 */
const SLOT_ELIGIBILITY: Record<string, string[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  K: ["K"],
  DEF: ["DEF"],
  DL: ["DL"],
  LB: ["LB"],
  DB: ["DB"],
  FLEX: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  REC_FLEX: ["WR", "TE"],
  WRRB_FLEX: ["WR", "RB"],
  IDP_FLEX: ["DL", "LB", "DB"],
};

/** Slots that are never started — skip entirely. */
const BENCH_SLOTS = new Set(["BN", "IR", "IR_TAXI", "IL"]);

/**
 * Specificity order for filling slots. More specific (single-position) slots
 * are filled first so broad FLEX slots don't steal single-position players.
 *
 * Lower number = filled first.
 */
const SLOT_PRIORITY: Record<string, number> = {
  QB: 0,
  K: 1,
  DEF: 2,
  DL: 3,
  LB: 4,
  DB: 5,
  RB: 6,
  WR: 7,
  TE: 8,
  REC_FLEX: 9,
  WRRB_FLEX: 10,
  FLEX: 11,
  IDP_FLEX: 12,
  SUPER_FLEX: 13,
};

// ─── Optimal lineup solver ────────────────────────────────────────────────────

/**
 * Given a list of scored players (position + points) and a list of starting
 * slots, compute the maximum possible total score by assigning players
 * optimally.
 *
 * Uses a greedy approach: fill slots in specificity order; for each slot pick
 * the highest-scoring unused eligible player. This is optimal for standard
 * fantasy lineup structures (a full LP/matching solution would be overkill and
 * slower without meaningful accuracy gains for typical roster sizes).
 */
function solveOptimalLineup(
  /** Each rostered player's position and points for this week. */
  rosterPlayers: Array<{ position: string; points: number }>,
  /** The starting slot strings from roster_positions (BN/IR excluded by caller). */
  startingSlots: string[],
): number {
  // Sort slots by fill priority (most specific first).
  const sortedSlots = [...startingSlots].sort(
    (a, b) => (SLOT_PRIORITY[a] ?? 99) - (SLOT_PRIORITY[b] ?? 99),
  );

  // Track which players have been assigned.
  const used = new Array<boolean>(rosterPlayers.length).fill(false);

  let total = 0;

  for (const slot of sortedSlots) {
    const eligible = SLOT_ELIGIBILITY[slot];
    if (!eligible) continue; // unknown slot type — skip

    // Find the highest-scoring unused eligible player.
    let bestIdx = -1;
    let bestPts = -Infinity;
    for (let i = 0; i < rosterPlayers.length; i++) {
      if (used[i]) continue;
      const p = rosterPlayers[i];
      if (!eligible.includes(p.position)) continue;
      if (p.points > bestPts) {
        bestPts = p.points;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      used[bestIdx] = true;
      total += rosterPlayers[bestIdx].points;
    }
  }

  return total;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Computes season Max PF for every roster in `leagueId`.
 *
 * @returns Map from rosterId → max PF (sum of optimal weekly scores).
 */
export async function computeMaxPF(
  provider: FantasyProvider,
  leagueId: string,
  weekCount: number,
): Promise<Map<number, number>> {
  // Fetch league (for roster_positions), all rosters, all week matchups,
  // and the player map — all in parallel.
  const weekNums = Array.from({ length: weekCount }, (_, i) => i + 1);

  const [league, allPlayers, ...weeklyMatchups] = await Promise.all([
    provider.getLeague(leagueId),
    provider.getPlayers ? provider.getPlayers() : Promise.resolve({} as Record<string, import("../domain/fantasy.js").Player>),
    ...weekNums.map((w) => provider.getMatchups(leagueId, w)),
  ]);

  // Parse starting slots from the league's rosterPositions array.
  // Sleeper returns e.g. ["QB","WR","WR","RB","RB","TE","FLEX","BN","BN","BN"].
  const startingSlots = league.rosterPositions.filter((p) => !BENCH_SLOTS.has(p));

  // No starting slot info → can't compute Max PF.
  if (startingSlots.length === 0) {
    return new Map();
  }

  // Accumulate Max PF per roster across all weeks.
  const maxPFByRoster = new Map<number, number>();

  for (const weekMatchups of weeklyMatchups) {
    for (const matchup of weekMatchups) {
      if (!matchup.playersPoints) continue; // week not yet scored

      // Build the per-player list for this roster.
      const rosterPlayers = matchup.players
        .map((playerId) => {
          const pts = matchup.playersPoints![playerId] ?? 0;
          const playerInfo = allPlayers[playerId];
          // Use the player's primary position. Fall back to "" (will be skipped
          // by the solver since no slot lists "" as eligible).
          const position = playerInfo?.position ?? "";
          return { position, points: pts };
        })
        // Filter out players with 0 points AND no position — likely missing data.
        // Keep 0-pt players with known positions (they might have just not played).
        .filter((p) => p.position !== "");

      const optimal = solveOptimalLineup(rosterPlayers, startingSlots);
      const prev = maxPFByRoster.get(matchup.rosterId) ?? 0;
      maxPFByRoster.set(matchup.rosterId, prev + optimal);
    }
  }

  return maxPFByRoster;
}
