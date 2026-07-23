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
 * Algorithm: standard "circle method" round robin for the base rotation,
 * repeated/truncated to fit the requested week count, then a best-effort
 * swap pass to honor locked matchups without breaking the one-game-per-team
 * constraint. This is NOT guaranteed optimal — see `warnings` in the result.
 */

/** Hard cap on team count this tool supports. */
export const MAX_TEAMS = 16;

/** Regular-season length bounds this tool supports. */
export const MIN_SEASON_WEEKS = 1;
export const MAX_SEASON_WEEKS = 18;

/** Max number of shared weeks a pinned rivalry pair can be assigned to. */
export const MAX_RIVALRY_WEEKS = 2;

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
  /** "auto" fills every week from the round-robin rotation, repeating it
   *  (reshuffled) once the full rotation has been used. `1` or `2` caps
   *  the rotation to that many passes and leaves remaining weeks empty
   *  for locked/manual matchups only. */
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

/**
 * Circle method: fixes the first team and rotates the rest around it.
 * For N teams (N even after padding with a bye), produces N-1 rounds, each
 * with N/2 pairings, such that every team plays every other team exactly
 * once across the full set of rounds.
 */
function circleMethodRounds(teamIds: string[]): { a: string; b: string }[][] {
  const ids = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE_ID];
  const n = ids.length;
  const rounds: { a: string; b: string }[][] = [];
  const fixed = ids[0]!;
  let rotating = ids.slice(1);

  for (let r = 0; r < n - 1; r++) {
    const round: { a: string; b: string }[] = [];
    const left = [fixed, ...rotating.slice(0, n / 2 - 1)];
    const right = [...rotating.slice(n / 2 - 1)].reverse();
    for (let i = 0; i < n / 2; i++) {
      round.push({ a: left[i]!, b: right[i]! });
    }
    rounds.push(round);
    // rotate: last element moves to front of the rotating list
    rotating = [rotating[rotating.length - 1]!, ...rotating.slice(0, -1)];
  }
  return rounds;
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

  const teamIds = shuffle(teams.map((t) => t.id));
  const baseRounds = shuffle(circleMethodRounds(teamIds));
  const maxPasses =
    options.matchesPerOpponent === "auto" ? Infinity : options.matchesPerOpponent;

  const weeks: GeneratedWeek[] = [];
  for (let w = 1; w <= options.weeks; w++) {
    const pass = Math.floor((w - 1) / baseRounds.length);
    if (pass >= maxPasses) {
      // Ran out of allotted rotations — leave the week empty for manual /
      // locked-only assignment rather than repeating opponents further.
      weeks.push({ week: w, matchups: [] });
      continue;
    }
    const round = baseRounds[(w - 1) % baseRounds.length]!;
    const matchups: ScheduledMatchup[] = round.map(({ a, b }) => ({
      teamAId: a === BYE_ID ? b : a,
      teamBId: a === BYE_ID || b === BYE_ID ? null : b,
      locked: false,
    }));
    weeks.push({ week: w, matchups });
  }

  applyLockedMatchups(weeks, locked, warnings);

  return { weeks, warnings };
}

/**
 * Best-effort swap pass: for each locked matchup, find team A and team B's
 * current opponents that week and swap so A faces B directly. If either
 * team already has a bye or the swap would double-book a team, the locked
 * matchup is skipped with a warning instead of corrupting the schedule.
 */
function applyLockedMatchups(
  weeks: GeneratedWeek[],
  locked: LockedMatchup[],
  warnings: string[],
): void {
  for (const lock of locked) {
    const week = weeks.find((w) => w.week === lock.week);
    if (!week) {
      warnings.push(`Week ${lock.week} is outside the schedule — skipped a locked matchup.`);
      continue;
    }

    const alreadyMatched = week.matchups.some(
      (m) =>
        (m.teamAId === lock.teamAId && m.teamBId === lock.teamBId) ||
        (m.teamAId === lock.teamBId && m.teamBId === lock.teamAId),
    );
    if (alreadyMatched) {
      week.matchups = week.matchups.map((m) =>
        (m.teamAId === lock.teamAId || m.teamBId === lock.teamAId) &&
        (m.teamAId === lock.teamBId || m.teamBId === lock.teamBId)
          ? { ...m, locked: true }
          : m,
      );
      continue;
    }

    const findSlot = (teamId: string) =>
      week.matchups.find((m) => m.teamAId === teamId || m.teamBId === teamId);

    const slotA = findSlot(lock.teamAId);
    const slotB = findSlot(lock.teamBId);

    if (!slotA || !slotB || slotA.locked || slotB.locked) {
      warnings.push(
        `Could not pin the rivalry matchup for week ${lock.week} — one of the teams already has a locked game that week.`,
      );
      continue;
    }
    if (slotA.teamBId === null || slotB.teamBId === null) {
      warnings.push(
        `Could not pin the rivalry matchup for week ${lock.week} — one of the teams has a bye that week.`,
      );
      continue;
    }

    // slotA = A vs C, slotB = B vs D → swap to A vs B, C vs D
    const otherOfA = slotA.teamAId === lock.teamAId ? slotA.teamBId! : slotA.teamAId;
    const otherOfB = slotB.teamAId === lock.teamBId ? slotB.teamBId! : slotB.teamAId;

    slotA.teamAId = lock.teamAId;
    slotA.teamBId = lock.teamBId;
    slotA.locked = true;
    slotB.teamAId = otherOfA;
    slotB.teamBId = otherOfB;
  }
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
  const pairKey = (a: string, b: string) => [a, b].sort().join("|");

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
      const pairKey = [m.teamAId, m.teamBId].sort().join("|");
      const meetingNumber = (seenCounts.get(pairKey) ?? 0) + 1;
      seenCounts.set(pairKey, meetingNumber);
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
