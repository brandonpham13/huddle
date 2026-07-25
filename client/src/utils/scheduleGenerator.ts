/**
 * Schedule generator — pure functions for building a fantasy season schedule
 * client-side (no server round trip, no persistence). Mirrors the workflow
 * of ffschedulemaker.com: take a team list, some options, and a set of
 * "locked" (rivalry) matchups pinned to specific weeks, then produce a
 * week-by-week grid where every team plays exactly one game per week (or
 * sits a bye, for odd team counts).
 *
 * Kept fully independent of React/UI so the algorithm can be swapped out or
 * refined (e.g. once real ffschedulemaker.com behavior is confirmed) without
 * touching any component.
 *
 * Algorithm: locked/rivalry matchups are placed first, week by week; the
 * remaining teams each week are paired off by a greedy minimum-repeat
 * matching — among all still-available pairs, always take the pair that
 * has faced off the fewest times so far, tie-broken randomly — which keeps
 * every week's fill globally aware of the whole season instead of only
 * that week. The whole build is retried many times with different random
 * orderings and the best-scoring attempt (fewest 3+ meetings, fewest pairs
 * that never meet) is kept. This is NOT guaranteed optimal, but it reliably
 * finds an even once/twice split when one exists — see `warnings` for any
 * locked matchup that genuinely couldn't be honored (week out of range, or
 * a team pinned to two rivals in the same week).
 */

/** Hard cap on team count this tool supports. */
export const MAX_TEAMS = 16;

/** Regular-season length bounds this tool supports. */
export const MIN_SEASON_WEEKS = 1;
export const MAX_SEASON_WEEKS = 18;

/** Max number of shared weeks a pinned rivalry pair can be assigned to. */
export const MAX_RIVALRY_WEEKS = 2;

/** How many full-season attempts to try before keeping the best-scoring one. */
const ATTEMPTS = 300;

export interface GeneratorTeam {
  /** Stable id for this generator run — the roster's id as a string, or a
   *  synthetic id (e.g. "bye-1") for placeholder/bye teams. */
  id: string;
  name: string;
  avatar: string | null;
  /** Null for a manually-added placeholder (bye) team. */
  rosterId: number | null;
}

export interface LockedMatchup {
  week: number;
  teamAId: string;
  teamBId: string;
}

export type MatchesPerOpponent = "auto" | 1 | 2;

export interface ScheduleOptions {
  /** Regular-season length in weeks. */
  weeks: number;
  /** "auto" lets the auto-fill portion repeat an opponent as many times as
   *  needed to fill every week. `1` or `2` caps how many times the *auto*
   *  fill can pair the same two teams — once that cap is hit for a team,
   *  it's simply left unscheduled that week rather than forcing a repeat.
   *  Locked/rivalry matchups are exempt from this cap. */
  matchesPerOpponent: MatchesPerOpponent;
}

export interface ScheduledMatchup {
  teamAId: string;
  /** Null = this team has a bye this week (only possible with an odd
   *  number of teams). */
  teamBId: string | null;
  locked: boolean;
}

export interface GeneratedWeek {
  week: number;
  matchups: ScheduledMatchup[];
}

export interface GeneratedSchedule {
  weeks: GeneratedWeek[];
  /** Best-effort notices — e.g. a locked matchup that couldn't be honored. */
  warnings: string[];
}

const BYE_ID = "__bye__";

/** One row in the Rivalry Weeks panel — a team pairing, filled in or not. */
export interface RivalryRow {
  teamAId: string | null;
  teamBId: string | null;
}

export function emptyRivalryRow(): RivalryRow {
  return { teamAId: null, teamBId: null };
}

/** Expands completed rivalry rows × selected weeks into `LockedMatchup`s. */
export function buildRivalryLockedMatchups(
  rows: RivalryRow[],
  selectedWeeks: number[],
): LockedMatchup[] {
  const pairs = rows.filter((r) => r.teamAId && r.teamBId && r.teamAId !== r.teamBId);
  return selectedWeeks.flatMap((week) =>
    pairs.map((r) => ({ week, teamAId: r.teamAId!, teamBId: r.teamBId! })),
  );
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Canonical key for an unordered team pair, used to tally head-to-head counts. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Greedily pairs off `ids` (assumed even length) minimizing repeats: builds
 * every candidate pair, sorts by how many times that pair has already met
 * (ties broken by the pre-shuffled order), then walks the sorted list
 * taking each pair whose teams are both still free. `cap` excludes any
 * candidate that's already met `cap` times or more (used for the "1" / "2"
 * matchesPerOpponent modes) — teams that end up with no valid candidate
 * under the cap are simply left out of the returned pairs.
 */
function buildWeekMatching(
  ids: string[],
  counts: Map<string, number>,
  cap: number,
): { a: string; b: string }[] {
  const pool = shuffle(ids);
  const candidates: { a: string; b: string; cost: number }[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const cost = counts.get(pairKey(pool[i]!, pool[j]!)) ?? 0;
      if (cost < cap) candidates.push({ a: pool[i]!, b: pool[j]!, cost });
    }
  }
  candidates.sort((x, y) => x.cost - y.cost);

  const used = new Set<string>();
  const result: { a: string; b: string }[] = [];
  for (const c of candidates) {
    if (used.has(c.a) || used.has(c.b)) continue;
    used.add(c.a);
    used.add(c.b);
    result.push({ a: c.a, b: c.b });
  }
  return result;
}

/** Groups locked matchups by week, dropping (with a warning) any that are
 * out of range or pin a team to two different rivals in the same week. */
function groupLocksByWeek(
  locked: LockedMatchup[],
  totalWeeks: number,
  warnings: string[],
): Map<number, LockedMatchup[]> {
  const byWeek = new Map<number, LockedMatchup[]>();
  for (const lock of locked) {
    if (lock.week < 1 || lock.week > totalWeeks) {
      warnings.push(`Week ${lock.week} is outside the schedule — skipped a locked matchup.`);
      continue;
    }
    const existing = byWeek.get(lock.week) ?? [];
    const usedTeams = new Set(existing.flatMap((l) => [l.teamAId, l.teamBId]));
    if (usedTeams.has(lock.teamAId) || usedTeams.has(lock.teamBId)) {
      warnings.push(
        `Week ${lock.week}: a team is pinned to more than one rivalry matchup — kept the first, skipped the rest.`,
      );
      continue;
    }
    existing.push(lock);
    byWeek.set(lock.week, existing);
  }
  return byWeek;
}

/** Builds one full-season attempt. Returns null only if locks conflict with
 * the one-game-per-team constraint in a way that can't be resolved. */
function attemptSchedule(
  allIds: string[],
  options: ScheduleOptions,
  locksByWeek: Map<number, LockedMatchup[]>,
): { weeks: GeneratedWeek[]; counts: Map<string, number> } {
  const cap = options.matchesPerOpponent === "auto" ? Infinity : options.matchesPerOpponent;
  const counts = new Map<string, number>();
  const bump = (a: string, b: string) => counts.set(pairKey(a, b), (counts.get(pairKey(a, b)) ?? 0) + 1);

  const weeks: GeneratedWeek[] = [];
  for (let w = 1; w <= options.weeks; w++) {
    const locks = locksByWeek.get(w) ?? [];
    const lockedTeamIds = new Set(locks.flatMap((l) => [l.teamAId, l.teamBId]));
    const remaining = allIds.filter((id) => !lockedTeamIds.has(id));

    const matchups: ScheduledMatchup[] = locks.map((l) => ({
      teamAId: l.teamAId,
      teamBId: l.teamBId,
      locked: true,
    }));
    for (const l of locks) bump(l.teamAId, l.teamBId);

    for (const { a, b } of buildWeekMatching(remaining, counts, cap)) {
      matchups.push({
        teamAId: a === BYE_ID ? b : a,
        teamBId: a === BYE_ID || b === BYE_ID ? null : b,
        locked: false,
      });
      bump(a, b);
    }

    weeks.push({ week: w, matchups });
  }

  return { weeks, counts };
}

/** Higher is better. Heavily penalizes 3+ meetings (what we're actually
 * trying to eliminate), then pairs that never meet, then unevenness. */
function scoreAttempt(
  counts: Map<string, number>,
  totalPairs: number,
): { score: number; clean: boolean } {
  let tripleOrMore = 0;
  let sumSquares = 0;
  let seen = 0;
  for (const c of counts.values()) {
    if (c >= 3) tripleOrMore++;
    sumSquares += c * c;
    seen++;
  }
  const never = totalPairs - seen;
  return {
    score: -1000 * tripleOrMore - 100 * never - sumSquares,
    clean: tripleOrMore === 0 && never === 0,
  };
}

/**
 * Builds a full season schedule.
 *
 * @param teams        Teams to schedule (order does not matter — shuffled
 *                      internally so repeated generates produce variety).
 * @param options       Week count + repeat-opponent behavior.
 * @param locked        Rivalry / pinned matchups to honor where possible.
 */
export function generateSchedule(
  teams: GeneratorTeam[],
  options: ScheduleOptions,
  locked: LockedMatchup[] = [],
): GeneratedSchedule {
  const warnings: string[] = [];
  if (teams.length < 2) {
    return { weeks: [], warnings: ["Need at least two teams to generate a schedule."] };
  }

  const realIds = teams.map((t) => t.id);
  const allIds = realIds.length % 2 === 0 ? realIds : [...realIds, BYE_ID];
  const totalPairs = (allIds.length * (allIds.length - 1)) / 2;

  const locksByWeek = groupLocksByWeek(locked, options.weeks, warnings);

  let best: { weeks: GeneratedWeek[]; counts: Map<string, number> } | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < ATTEMPTS; i++) {
    const attempt = attemptSchedule(allIds, options, locksByWeek);
    const { score, clean } = scoreAttempt(attempt.counts, totalPairs);
    if (score > bestScore) {
      best = attempt;
      bestScore = score;
      // No pair meets 3+ times and every pair meets at least once — the two
      // things we're actually optimizing for are both satisfied, so further
      // attempts can only improve evenness, not correctness. Stop early.
      if (clean) break;
    }
  }

  return { weeks: best!.weeks, warnings };
}

export interface MatchupFrequencyBucket {
  /** Number of times these pairs face off across the schedule (0 = never). */
  timesPlayed: number;
  /** How many unique team pairs land in this bucket. */
  pairCount: number;
}

export interface MatchupFrequencySummary {
  buckets: MatchupFrequencyBucket[];
  totalPairs: number;
  /** Team-id pairs that never face off, for surfacing in a tooltip/list. */
  neverPlayPairs: [string, string][];
}

/**
 * For every unique pair of teams, counts how many times they face off across
 * the schedule, then buckets pairs by that count (0 = never play, 1 = play
 * once, 2 = play twice, ...). Byes (`teamBId === null`) don't count as a
 * matchup for either side.
 */
export function summarizeMatchupFrequency(
  schedule: GeneratedSchedule,
  teamIds: string[],
): MatchupFrequencySummary {
  const timesPlayed = new Map<string, number>();
  for (const week of schedule.weeks) {
    for (const m of week.matchups) {
      if (!m.teamBId) continue;
      const key = pairKey(m.teamAId, m.teamBId);
      timesPlayed.set(key, (timesPlayed.get(key) ?? 0) + 1);
    }
  }

  const counts: number[] = [];
  const neverPlayPairs: [string, string][] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const a = teamIds[i]!;
      const b = teamIds[j]!;
      const count = timesPlayed.get(pairKey(a, b)) ?? 0;
      counts.push(count);
      if (count === 0) neverPlayPairs.push([a, b]);
    }
  }

  const maxCount = Math.max(0, ...counts);
  const pairCountByTimes = new Array(maxCount + 1).fill(0);
  for (const c of counts) pairCountByTimes[c] += 1;

  return {
    buckets: pairCountByTimes.map((pairCount, timesPlayed) => ({ timesPlayed, pairCount })),
    totalPairs: counts.length,
    neverPlayPairs,
  };
}

/**
 * Assigns each matchup its meeting number for that team pair — 1 the first
 * time two teams face off in the schedule, 2 the second, etc. — keyed by
 * `"<week>-<index within week's matchups array>"` so the grid can look it
 * up per cell. Byes (`teamBId === null`) aren't a meeting and are skipped.
 */
export function computeMeetingNumbers(schedule: GeneratedSchedule): Map<string, number> {
  const seenCounts = new Map<string, number>();
  const meetingNumberByCell = new Map<string, number>();
  const orderedWeeks = [...schedule.weeks].sort((a, b) => a.week - b.week);

  for (const week of orderedWeeks) {
    week.matchups.forEach((m, i) => {
      if (!m.teamBId) return;
      const key = pairKey(m.teamAId, m.teamBId);
      const meetingNumber = (seenCounts.get(key) ?? 0) + 1;
      seenCounts.set(key, meetingNumber);
      meetingNumberByCell.set(`${week.week}-${i}`, meetingNumber);
    });
  }

  return meetingNumberByCell;
}

/** CSV export — one row per week, "Team A vs Team B" per matchup column. */
export function scheduleToCsv(
  schedule: GeneratedSchedule,
  teamsById: Map<string, GeneratorTeam>,
): string {
  const nameOf = (id: string | null) => (id ? (teamsById.get(id)?.name ?? id) : "BYE");
  const maxMatchups = Math.max(1, ...schedule.weeks.map((w) => w.matchups.length));
  const header = ["Week", ...Array.from({ length: maxMatchups }, (_, i) => `Matchup ${i + 1}`)];
  const rows = schedule.weeks.map((w) => {
    const cells = w.matchups.map((m) => `${nameOf(m.teamAId)} vs ${nameOf(m.teamBId)}`);
    while (cells.length < maxMatchups) cells.push("");
    return [String(w.week), ...cells];
  });
  const escape = (v: string) => (v.includes(",") ? `"${v.replace(/"/g, '""')}"` : v);
  return [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
}

/** Plain-text export for pasting into Discord/Slack/group chats. */
export function scheduleToText(
  schedule: GeneratedSchedule,
  teamsById: Map<string, GeneratorTeam>,
): string {
  const nameOf = (id: string | null) => (id ? (teamsById.get(id)?.name ?? id) : "BYE");
  return schedule.weeks
    .map((w) => {
      const lines = w.matchups.map((m) => `  ${nameOf(m.teamAId)} vs ${nameOf(m.teamBId)}`);
      return [`Week ${w.week}`, ...lines].join("\n");
    })
    .join("\n\n");
}
