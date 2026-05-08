import type { Roster, Matchup, TeamUser } from "../domain/fantasy.js";

// ─── Algorithm contract ───────────────────────────────────────────────────────

/**
 * All the data an algorithm needs to score every team in a league.
 * Add more fields here as new algorithms require them.
 */
export interface PowerRankingInput {
  rosters: Roster[];
  matchupsByWeek: Matchup[][]; // index 0 = week 1
  users: TeamUser[];
  currentWeek: number;
}

/**
 * Controls what the UI column shows.
 * - "score" (default): the raw computed value
 * - "rank": the rank position (1 = best); raw score is hidden
 */
export type ColumnDisplayMode = "score" | "rank";

/**
 * An algorithm returns a score for each rosterId.
 * Higher score = better ranking (algorithms normalise internally).
 */
export interface PowerRankingAlgorithm {
  /** Short machine-readable key, used as column id */
  id: string;
  /** Human-readable column label */
  label: string;
  /** Brief tooltip / description */
  description: string;
  /**
   * Controls what value the UI column renders.
   * "score" = raw computed value, "rank" = ordinal rank position (hides raw score).
   * Defaults to "score" when omitted.
   */
  displayMode?: ColumnDisplayMode;
  compute(input: PowerRankingInput): Map<number, number>;
}

// ─── Registry ────────────────────────────────────────────────────────────────

const algorithms: PowerRankingAlgorithm[] = [];

export function registerAlgorithm(algo: PowerRankingAlgorithm): void {
  algorithms.push(algo);
}

export function getAlgorithms(): PowerRankingAlgorithm[] {
  return [...algorithms];
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface PowerRankingColumn {
  id: string;
  label: string;
  description: string;
  displayMode: ColumnDisplayMode;
}

export interface PowerRankingRow {
  rosterId: number;
  teamName: string;
  avatar: string | null;
  /** Raw scores keyed by algorithm id — null means not computed */
  scores: Record<string, number | null>;
  /** Per-algorithm ranks (1 = best) keyed by algorithm id */
  ranks: Record<string, number | null>;
  /** Overall rank (average rank across all algorithms, lower = better) */
  overallRank: number;
}

export interface PowerRankingsResult {
  columns: PowerRankingColumn[];
  rows: PowerRankingRow[];
}

// ─── Compute ─────────────────────────────────────────────────────────────────

export function computePowerRankings(
  input: PowerRankingInput,
): PowerRankingsResult {
  const algos = getAlgorithms();
  const userMap = new Map(input.users.map((u) => [u.userId, u]));

  // Run all algorithms
  const scoresByAlgo = new Map<string, Map<number, number>>();
  for (const algo of algos) {
    try {
      scoresByAlgo.set(algo.id, algo.compute(input));
    } catch {
      scoresByAlgo.set(algo.id, new Map());
    }
  }

  // Convert scores → per-algorithm rank (1 = best)
  const ranksByAlgo = new Map<string, Map<number, number>>();
  for (const algo of algos) {
    const scores = scoresByAlgo.get(algo.id)!;
    const sorted = [...input.rosters]
      .map((r) => ({
        rosterId: r.rosterId,
        score: scores.get(r.rosterId) ?? null,
      }))
      .filter((r) => r.score !== null)
      .sort((a, b) => b.score! - a.score!);
    const rankMap = new Map<number, number>();
    sorted.forEach((r, i) => rankMap.set(r.rosterId, i + 1));
    ranksByAlgo.set(algo.id, rankMap);
  }

  // Build rows
  const rows: PowerRankingRow[] = input.rosters.map((roster) => {
    const user = roster.ownerId ? userMap.get(roster.ownerId) : undefined;
    const teamName =
      user?.teamName ?? user?.displayName ?? `Team ${roster.rosterId}`;
    const avatar = user?.avatar ?? null;

    const scores: Record<string, number | null> = {};
    const ranks: Record<string, number | null> = {};
    let rankSum = 0;
    let rankCount = 0;

    for (const algo of algos) {
      const score = scoresByAlgo.get(algo.id)?.get(roster.rosterId) ?? null;
      scores[algo.id] = score !== undefined ? score : null;

      const rank = ranksByAlgo.get(algo.id)?.get(roster.rosterId) ?? null;
      ranks[algo.id] = rank;

      if (rank !== null) {
        rankSum += rank;
        rankCount++;
      }
    }

    const overallRank = rankCount > 0 ? rankSum / rankCount : Infinity;

    return {
      rosterId: roster.rosterId,
      teamName,
      avatar,
      scores,
      ranks,
      overallRank,
    };
  });

  // Sort by overall rank
  rows.sort((a, b) => a.overallRank - b.overallRank);

  const columns: PowerRankingColumn[] = algos.map((a) => ({
    id: a.id,
    label: a.label,
    description: a.description,
    displayMode: a.displayMode ?? "score",
  }));

  return { columns, rows };
}
