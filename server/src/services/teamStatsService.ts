/**
 * teamStatsService.ts
 *
 * Computes lifetime and per-season statistics for a single fantasy team
 * across an entire league family (multiple seasons of the same league).
 *
 * Called by the team-stats route; the result feeds the Team Page sections:
 *   - Season by Season table
 *   - Lifetime Statistics panel
 *   - Trophy Room
 *
 * Design notes:
 *   - We make *all* network calls in parallel where possible to keep latency low.
 *   - `provider.*` calls are the only I/O — no DB access from this layer.
 *   - All internal state is immutable and rebuit on every call (no caching here;
 *     the route layer or TanStack Query on the client own caching concerns).
 */

import type { FantasyProvider } from "../providers/types.js";
import type {
  League,
  Matchup,
  PlayoffMatchup,
  Roster,
  TeamUser,
} from "../domain/fantasy.js";
import type { TeamStats, SeasonStat, H2HRecord } from "../domain/fantasy.js";
import type { ProviderId } from "../domain/fantasy.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine how many regular-season weeks a league had.
 * We stop fetching matchups at (playoff_week_start - 1) if it exists,
 * or fall back to last_scored_leg, or default to 13.
 */
function regularSeasonWeekCount(league: League): number {
  const s = league.settings;
  const playoffStart =
    typeof s["playoff_week_start"] === "number" ? (s["playoff_week_start"] as number) : null;
  const lastScored =
    typeof s["last_scored_leg"] === "number" ? (s["last_scored_leg"] as number) : null;

  if (playoffStart && playoffStart > 1) return playoffStart - 1;
  if (lastScored && lastScored > 0) return lastScored;
  return 13; // safe default for most platforms
}

/**
 * Sort rosters by wins desc then PF desc to produce final regular-season
 * standings (seed). Returns a map of rosterId -> seed (1 = best).
 */
function computeSeeds(
  rosters: Roster[],
  pfOverride: Map<number, number>,
  winsOverride: Map<number, number>,
): Map<number, number> {
  // Use override maps (computed from matchup data) if available; fall back to
  // the roster's own record/pointsFor from the provider (which is already
  // aggregated correctly for completed seasons).
  const sorted = [...rosters].sort((a, b) => {
    const wA = winsOverride.get(a.rosterId) ?? a.record.wins;
    const wB = winsOverride.get(b.rosterId) ?? b.record.wins;
    if (wB !== wA) return wB - wA;
    const pfA = pfOverride.get(a.rosterId) ?? a.pointsFor;
    const pfB = pfOverride.get(b.rosterId) ?? b.pointsFor;
    return pfB - pfA;
  });

  const seeds = new Map<number, number>();
  sorted.forEach((r, idx) => seeds.set(r.rosterId, idx + 1));
  return seeds;
}

/**
 * Determine a roster's postseason result from the winners bracket.
 *
 * Strategy:
 *   1. Find the highest round number in the bracket — that's the championship round.
 *   2. The winner of that round is champion; the loser is runner_up.
 *   3. For 3rd place, look for a matchup whose `place` field equals 3, or a
 *      matchup in the round just below the championship whose loser_roster_id
 *      matches. Some providers use `place: 3` directly.
 *   4. Any other roster that appears in the bracket = made_playoffs.
 *   5. Roster absent from bracket = missed_playoffs.
 */
function resolvePostseason(
  rosterId: number,
  bracket: PlayoffMatchup[],
): SeasonStat["postseason"] {
  if (bracket.length === 0) return null;

  // Collect all roster IDs that appear anywhere in the bracket
  const bracketRosters = new Set<number>();
  for (const m of bracket) {
    if (m.team1_roster_id != null) bracketRosters.add(m.team1_roster_id);
    if (m.team2_roster_id != null) bracketRosters.add(m.team2_roster_id);
    if (m.winner_roster_id != null) bracketRosters.add(m.winner_roster_id);
    if (m.loser_roster_id != null) bracketRosters.add(m.loser_roster_id);
  }

  if (!bracketRosters.has(rosterId)) return "missed_playoffs";

  const maxRound = Math.max(...bracket.map((m) => m.round));
  const finalMatchup = bracket.find(
    (m) => m.round === maxRound && m.winner_roster_id != null,
  );

  if (finalMatchup?.winner_roster_id === rosterId) return "champion";
  if (finalMatchup?.loser_roster_id === rosterId) return "runner_up";

  // 3rd-place detection: look for explicit place=3, or the winner of the
  // second-highest-round consolation matchup (round === maxRound - 1 but
  // it's a loser bracket entry, etc.). Some providers flag it with `place`.
  const thirdPlaceMatchup = bracket.find(
    (m) => m.place === 3 && m.winner_roster_id != null,
  );
  if (thirdPlaceMatchup) {
    if (thirdPlaceMatchup.winner_roster_id === rosterId) return "third";
    if (thirdPlaceMatchup.loser_roster_id === rosterId) return "made_playoffs";
  }

  return "made_playoffs";
}

// ─── Per-season data collection ───────────────────────────────────────────────

interface SeasonData {
  league: League;
  /** The roster belonging to this ownerId in this season. Null if they weren't in this league. */
  roster: Roster | null;
  /** All regular-season matchups, indexed by week (0-indexed, i.e. [0] = week 1). */
  matchupsByWeek: Matchup[][];
  /** All rosters in the league (for seed computation). */
  allRosters: Roster[];
  /** All users in the league — used to resolve rosterId → team name for H2H display. */
  allUsers: TeamUser[];
  /** Winners bracket (empty array if league not complete or provider doesn't support it). */
  winnersBracket: PlayoffMatchup[];
}

/**
 * Fetches and collects all the raw data we need for one season of the family.
 * All I/O is done in parallel.
 */
async function fetchSeasonData(
  provider: FantasyProvider,
  leagueId: string,
  ownerId: string,
): Promise<SeasonData> {
  const league = await provider.getLeague(leagueId);
  const allRosters = await provider.getRosters(leagueId);

  // Find the roster for this owner in this league
  const roster = allRosters.find((r) => r.ownerId === ownerId) ?? null;

  const weekCount = regularSeasonWeekCount(league);
  const weekNums = Array.from({ length: weekCount }, (_, i) => i + 1);

  // Fetch all weeks in parallel, then fetch the bracket and users in parallel with that
  const [matchupsByWeek, winnersBracket, allUsers] = await Promise.all([
    Promise.all(weekNums.map((w) => provider.getMatchups(leagueId, w))),
    league.status === "complete" && provider.getWinnersBracket
      ? provider.getWinnersBracket(leagueId).catch(() => [] as PlayoffMatchup[])
      : Promise.resolve([] as PlayoffMatchup[]),
    // Fetch users so we can resolve rosterId -> team name for H2H display
    provider.getLeagueUsers(leagueId).catch(() => [] as TeamUser[]),
  ]);

  return { league, roster, matchupsByWeek, allRosters, allUsers, winnersBracket };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Computes the full TeamStats for one team across all seasons in a league family.
 *
 * @param provider   - The fantasy platform adapter
 * @param leagueIds  - All league IDs in the family, newest first
 * @param rosterId   - The roster ID in the *current* (first) league
 * @param ownerId    - The owner's user ID (stable across seasons on most platforms)
 */
export async function computeTeamStats(
  provider: FantasyProvider,
  leagueIds: string[],
  rosterId: number,
  ownerId: string,
): Promise<TeamStats> {
  if (leagueIds.length === 0) {
    throw new Error("computeTeamStats requires at least one leagueId");
  }

  // Fetch all seasons in parallel
  const seasonDataList = await Promise.all(
    leagueIds.map((lid) => fetchSeasonData(provider, lid, ownerId)),
  );

  // ── Accumulator state ─────────────────────────────────────────────────────
  const seasons: SeasonStat[] = [];

  // Lifetime record accumulators
  let totalWins = 0;
  let totalLosses = 0;
  let totalTies = 0;
  let totalPF = 0;
  let totalPA = 0;
  let totalGames = 0;

  let playoffAppearances = 0;
  let championships = 0;
  let runnerUps = 0;
  let thirdPlace = 0;
  const seedsForAvg: number[] = [];

  // Extremes — tracked as mutable "best so far" records
  let highScore: TeamStats["highScore"] = null;
  let lowScore: TeamStats["lowScore"] = null;
  let biggestWin: TeamStats["biggestWin"] = null;
  let worstLoss: TeamStats["worstLoss"] = null;

  // Weekly superlatives
  let mvpWeeks = 0;

  // Win/loss streak tracking across entire career (chronologically oldest first)
  // We rebuild the streak from the full chronological game list.
  const allGameResults: Array<"W" | "L" | "T"> = [];

  // H2H accumulation: opponentRosterId is per-league, but since rosters map
  // to the same human owner across seasons (matched by ownerId), we track by
  // opponentOwnerId when available, falling back to a per-league composite key.
  // For simplicity and correctness within a single league family, we key by
  // opponentRosterId within each season and merge by opponentOwnerId at the end.
  //
  // Structure: opponentOwnerId (or "noowner:<leagueId>:<rosterId>") -> record
  const h2hByOwner = new Map<
    string,
    { opponentRosterId: number; opponentOwnerId: string | null; opponentTeamName: string | null; wins: number; losses: number; ties: number }
  >();

  // ── Process each season ───────────────────────────────────────────────────
  for (const sd of seasonDataList) {
    const { league, roster, matchupsByWeek, allRosters, allUsers, winnersBracket } = sd;
    const leagueId = league.ref.leagueId;
    const season = league.season;

    // Build a map from ownerId -> preferred display name for this season.
    // Preference order: team name (custom) > display name > username.
    // This is the same resolution order used by teamName() in the client.
    const ownerIdToName = new Map<string, string>();
    for (const u of allUsers) {
      ownerIdToName.set(u.userId, u.teamName ?? u.displayName ?? u.username);
    }

    // If the owner wasn't in this league, include a zero-stat season row
    if (!roster) {
      seasons.push({
        leagueId,
        season,
        record: { wins: 0, losses: 0, ties: 0 },
        pointsFor: 0,
        pointsAgainst: 0,
        seed: null,
        postseason: null,
        powerRank: null,
      });
      continue;
    }

    const myRosterId = roster.rosterId;

    // Tally PF/PA and per-opponent record from matchup data.
    // We recompute this ourselves (rather than trusting roster.record) so we
    // have per-week detail needed for streak/extreme calculations.
    let seasonWins = 0;
    let seasonLosses = 0;
    let seasonTies = 0;
    let seasonPF = 0;
    let seasonPA = 0;

    // For seed computation — PF and wins we derived ourselves
    const pfByRoster = new Map<number, number>();
    const winsByRoster = new Map<number, number>();

    for (let weekIdx = 0; weekIdx < matchupsByWeek.length; weekIdx++) {
      const weekNum = weekIdx + 1;
      const weekMatchups = matchupsByWeek[weekIdx];

      // Find our entry in this week
      const myEntry = weekMatchups.find(
        (m) => m.rosterId === myRosterId && m.matchupId !== null,
      );
      if (!myEntry) continue; // bye week or week not yet scored

      // Accumulate PF for all rosters (seed computation)
      for (const m of weekMatchups) {
        pfByRoster.set(m.rosterId, (pfByRoster.get(m.rosterId) ?? 0) + m.points);
      }

      // MVP week: team had the highest score league-wide during regular season
      const playoffWeekStart =
        typeof league.settings["playoff_week_start"] === "number"
          ? (league.settings["playoff_week_start"] as number)
          : Infinity;
      if (weekNum < playoffWeekStart) {
        const weekMax = Math.max(...weekMatchups.map((m) => m.points));
        if (myEntry.points > 0 && myEntry.points >= weekMax) mvpWeeks++;
      }

      // Find the opponent in the same matchup
      const oppEntry = weekMatchups.find(
        (m) => m.matchupId === myEntry.matchupId && m.rosterId !== myRosterId,
      );
      const oppPoints = oppEntry?.points ?? 0;
      const oppRosterId = oppEntry?.rosterId ?? null;

      seasonPF += myEntry.points;
      seasonPA += oppPoints;

      // Determine result
      let result: "W" | "L" | "T";
      if (myEntry.points > oppPoints) {
        result = "W";
        seasonWins++;
        winsByRoster.set(myRosterId, (winsByRoster.get(myRosterId) ?? 0) + 1);
      } else if (myEntry.points < oppPoints) {
        result = "L";
        winsByRoster.set(myRosterId, winsByRoster.get(myRosterId) ?? 0);
      } else {
        result = "T";
        seasonTies++;
        winsByRoster.set(myRosterId, winsByRoster.get(myRosterId) ?? 0);
      }

      if (result === "L") seasonLosses++;

      allGameResults.push(result);

      // ── Scoring extremes ──────────────────────────────────────────────
      // Resolve opponent display name for extreme labeling
      const oppRoster = allRosters.find((r) => r.rosterId === oppRosterId);
      const oppOwnerId = oppRoster?.ownerId ?? null;
      const oppName = oppOwnerId ? (ownerIdToName.get(oppOwnerId) ?? null) : null;

      // High score
      if (highScore === null || myEntry.points > highScore.points) {
        highScore = { points: myEntry.points, opponentPoints: oppPoints, opponentName: oppName, season, week: weekNum, opponentRosterId: oppRosterId };
      }
      // Low score (only count games that were actually played, i.e. points > 0)
      if (myEntry.points > 0 && (lowScore === null || myEntry.points < lowScore.points)) {
        lowScore = { points: myEntry.points, opponentPoints: oppPoints, opponentName: oppName, season, week: weekNum, opponentRosterId: oppRosterId };
      }
      // Biggest win (only when we actually won)
      if (result === "W") {
        const margin = myEntry.points - oppPoints;
        if (biggestWin === null || margin > biggestWin.margin) {
          biggestWin = { margin, myPoints: myEntry.points, opponentPoints: oppPoints, opponentName: oppName, season, week: weekNum, opponentRosterId: oppRosterId };
        }
      }
      // Worst loss (only when we actually lost)
      if (result === "L") {
        const margin = oppPoints - myEntry.points; // positive = how badly we lost
        if (worstLoss === null || margin > worstLoss.margin) {
          worstLoss = { margin, myPoints: myEntry.points, opponentPoints: oppPoints, opponentName: oppName, season, week: weekNum, opponentRosterId: oppRosterId };
        }
      }

      // ── H2H accumulation ─────────────────────────────────────────────
      // oppRoster / oppOwnerId / oppName already resolved above for extremes
      if (oppRosterId != null) {
        // Use ownerId as key when we have it, otherwise fall back to a stable
        // composite that won't collide across leagues.
        const key = oppOwnerId ?? `noowner:${leagueId}:${oppRosterId}`;

        const existing = h2hByOwner.get(key) ?? {
          opponentRosterId: oppRosterId,
          opponentOwnerId: oppOwnerId,
          // Seed with the name from the most recent season (first encounter since
          // seasonDataList is newest-first). Subsequent seasons won't overwrite.
          opponentTeamName: oppName,
          wins: 0,
          losses: 0,
          ties: 0,
        };

        if (result === "W") existing.wins++;
        else if (result === "L") existing.losses++;
        else existing.ties++;

        h2hByOwner.set(key, existing);
      }
    }

    // ── Seed ──────────────────────────────────────────────────────────────
    // Compute seeds using the PF we tallied from matchup data (more accurate
    // for in-progress seasons than the roster record which may lag).
    const seedMap = computeSeeds(allRosters, pfByRoster, winsByRoster);
    const seed = seedMap.get(myRosterId) ?? null;

    // ── Postseason result ─────────────────────────────────────────────────
    let postseason: SeasonStat["postseason"] = null;
    if (league.status === "complete") {
      postseason = resolvePostseason(myRosterId, winnersBracket);
    }

    // Tally lifetime playoff/championship counters
    if (postseason === "champion") { championships++; playoffAppearances++; }
    else if (postseason === "runner_up") { runnerUps++; playoffAppearances++; }
    else if (postseason === "third") { thirdPlace++; playoffAppearances++; }
    else if (postseason === "made_playoffs") playoffAppearances++;

    if (seed != null) seedsForAvg.push(seed);

    // Accumulate lifetime totals
    totalWins += seasonWins;
    totalLosses += seasonLosses;
    totalTies += seasonTies;
    totalPF += seasonPF;
    totalPA += seasonPA;
    totalGames += seasonWins + seasonLosses + seasonTies;

    seasons.push({
      leagueId,
      season,
      record: { wins: seasonWins, losses: seasonLosses, ties: seasonTies },
      pointsFor: seasonPF,
      pointsAgainst: seasonPA,
      seed,
      postseason,
      powerRank: null, // placeholder — wired in a future pass
    });
  }

  // ── Win/loss streaks ──────────────────────────────────────────────────────
  // Walk the full chronological game list and find the longest consecutive W
  // and L runs.
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let curWin = 0;
  let curLoss = 0;

  for (const r of allGameResults) {
    if (r === "W") {
      curWin++;
      curLoss = 0;
    } else if (r === "L") {
      curLoss++;
      curWin = 0;
    } else {
      // Tie resets both streaks
      curWin = 0;
      curLoss = 0;
    }
    if (curWin > longestWinStreak) longestWinStreak = curWin;
    if (curLoss > longestLossStreak) longestLossStreak = curLoss;
  }

  // ── Derived lifetime stats ────────────────────────────────────────────────
  const totalNonTie = totalWins + totalLosses;
  const winPct = totalNonTie > 0 ? totalWins / totalNonTie : 0;
  const avgPointsFor = totalGames > 0 ? totalPF / totalGames : 0;
  const avgPointsAgainst = totalGames > 0 ? totalPA / totalGames : 0;
  const avgFinish =
    seedsForAvg.length > 0
      ? seedsForAvg.reduce((a, b) => a + b, 0) / seedsForAvg.length
      : null;

  const h2h: H2HRecord[] = Array.from(h2hByOwner.values()).map((v) => ({
    opponentRosterId: v.opponentRosterId,
    opponentOwnerId: v.opponentOwnerId,
    opponentTeamName: v.opponentTeamName,
    wins: v.wins,
    losses: v.losses,
    ties: v.ties,
  }));

  return {
    careerRecord: { wins: totalWins, losses: totalLosses, ties: totalTies },
    winPct,
    playoffAppearances,
    championships,
    runnerUps,
    thirdPlace,
    avgFinish,
    avgPointsFor,
    avgPointsAgainst,
    highScore,
    lowScore,
    biggestWin,
    worstLoss,
    mvpWeeks,
    longestWinStreak,
    longestLossStreak,
    h2h,
    seasons,
  };
}

// Re-export the ProviderId type so consumers can import from this module if needed
export type { ProviderId };
