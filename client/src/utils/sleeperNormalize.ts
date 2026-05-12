/**
 * sleeperNormalize — utilities for translating Sleeper's raw data shapes into
 * the provider-agnostic domain types used throughout the client.
 *
 * Sleeper has several quirks that other fantasy APIs may not share. Keeping
 * this logic here means widgets and hooks stay provider-agnostic; if we add
 * a Yahoo or ESPN provider, we'd create a yahooNormalize.ts alongside this
 * file rather than scattering provider-specific logic across the UI.
 *
 * ── Defense key mismatch ────────────────────────────────────────────────────
 * Rosters store defenses by a numeric player ID (e.g. "4046" for the Bears
 * DEF), but Sleeper's per-week stats endpoint keys team defenses as
 * "TEAM_BUF", "TEAM_CHI", etc.
 *
 * buildDefStatsKeyMap() resolves this by iterating the roster player IDs,
 * looking each one up in the player dictionary, and — when the position is
 * "DEF" — emitting a "TEAM_<abbr>" → rosterId entry.
 *
 * ── Avatar URLs ─────────────────────────────────────────────────────────────
 * Sleeper stores avatars as opaque hashes. sleeperAvatarUrl() converts a
 * hash to the full CDN URL. Centralising this means we only update one line
 * if Sleeper ever changes their CDN domain or path structure.
 *
 * ── Fantasy scoring key ─────────────────────────────────────────────────────
 * Sleeper's stats objects expose several pre-computed fantasy totals keyed by
 * scoring format (pts_ppr, pts_half_ppr, pts_std). getFantasyPoints() reads
 * pts_ppr as the default. If we later support per-league scoring settings or
 * add other providers this is the single place to update.
 */

import type { Roster } from "../types/fantasy";

// ── Avatar URLs ───────────────────────────────────────────────────────────────

const SLEEPER_AVATAR_BASE = "https://sleepercdn.com/avatars/thumbs";

/**
 * Convert a Sleeper avatar hash to its full CDN thumbnail URL.
 * Returns null when the hash is falsy so callers can fall through to a
 * placeholder without an extra null-check.
 */
export function sleeperAvatarUrl(hash: string | null | undefined): string | null {
  if (!hash) return null;
  return `${SLEEPER_AVATAR_BASE}/${hash}`;
}

// ── Fantasy scoring ──────────────────────────────────────────────────────────

/**
 * Compute a player's fantasy points for a given week using the league's
 * custom scoring settings.
 *
 * Sleeper's `scoring_settings` maps stat keys (e.g. "pass_yd", "rec",
 * "bonus_rec_te") to their point multipliers. The player stats object from
 * the `/stats` endpoint uses the same keys. Computing the dot product of
 * the two gives the exact score Sleeper would show for that league.
 *
 * Bonus threshold fields (e.g. "bonus_pass_yd_400", "bonus_rec_yd_100")
 * are pre-computed as 0/1 flags in the stats object by Sleeper, so they
 * multiply cleanly with no special-case logic needed here.
 *
 * @param stats           - Raw Sleeper per-player stat record for one week.
 * @param scoringSettings - League's scoring_settings map.
 * @returns Fantasy point total for that player in that week.
 */
export function applyCustomScoring(
  stats: Record<string, number>,
  scoringSettings: Record<string, number>,
): number {
  let total = 0;
  for (const [key, multiplier] of Object.entries(scoringSettings)) {
    const statValue = stats[key];
    if (statValue) total += statValue * multiplier;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Extract the fantasy point total from a Sleeper per-player stats object.
 *
 * When `scoringSettings` is provided (non-empty), computes points from raw
 * stats via `applyCustomScoring` so custom-scoring leagues are accurate.
 * Falls back to Sleeper's pre-computed `pts_ppr` field otherwise.
 *
 * @param stats           - Raw stats record for a single player/week.
 * @param scoringSettings - Optional league scoring settings.
 */
export function getFantasyPoints(
  stats: Record<string, number>,
  scoringSettings?: Record<string, number>,
): number {
  if (scoringSettings && Object.keys(scoringSettings).length > 0) {
    return applyCustomScoring(stats, scoringSettings);
  }
  // Fallback: use Sleeper's pre-computed PPR total.
  return Number(stats["pts_ppr"] ?? 0);
}

// ── Defense per-week points ─────────────────────────────────────────────────────

import type { Matchup } from "../types/fantasy";

/**
 * Build a map from Sleeper's defense stats key ("TEAM_BUF") to the fantasy
 * points that defense scored in the given week.
 *
 * Sleeper's bulk stats endpoint returns cumulative season totals for TEAM_
 * entries, not per-week scores. The per-week DEF score lives in the matchup
 * data as `playersPoints[numericPlayerId]`. We use the defTeamToRoster map
 * (from buildDefStatsKeyMap) to find which roster owns each DEF, then look
 * up that defense's numeric player ID via the roster's players list.
 *
 * @param rosters     - League rosters.
 * @param matchups    - This week's matchup entries (must include playersPoints).
 * @param players     - Player dictionary, used to match team abbr → numeric ID.
 * @returns Map<"TEAM_XXX", weeklyFantasyPoints>
 */
export function buildDefWeeklyPointsMap(
  rosters: Matchup[],
  players: Record<string, PlayerWithPositionAndTeam> | undefined,
  allRosters: import("../types/fantasy").Roster[],
): Map<string, number> {
  const map = new Map<string, number>();
  if (!players) return map;

  for (const matchup of rosters) {
    if (!matchup.playersPoints) continue;
    // Find all DEF player IDs on this roster by checking the player dictionary.
    const roster = allRosters.find((r) => r.rosterId === matchup.rosterId);
    if (!roster) continue;
    for (const pid of roster.players ?? []) {
      if (players[pid]?.position === "DEF" && players[pid]?.team) {
        const teamKey = `TEAM_${players[pid].team}`;
        const pts = matchup.playersPoints[pid] ?? 0;
        map.set(teamKey, pts);
      }
    }
  }

  return map;
}

// ── Defense key mismatch ──────────────────────────────────────────────────────

/**
 * Minimal shape required from a player entry for defense key resolution.
 * The domain Player type satisfies this; future provider player types can too.
 */
export interface PlayerWithPositionAndTeam {
  position: string;
  team?: string | null;
}

/**
 * Build a map from Sleeper's defense stats key ("TEAM_BUF") to the rosterId
 * of the team that owns that defense in the given league.
 *
 * @param rosters  - League roster list (each roster has a `players` array of player IDs).
 * @param players  - Player dictionary keyed by player ID.
 * @returns Map<"TEAM_XXX", rosterId>
 */
export function buildDefStatsKeyMap(
  rosters: Roster[],
  players: Record<string, PlayerWithPositionAndTeam> | undefined,
): Map<string, number> {
  const map = new Map<string, number>();
  if (!players) return map;

  for (const roster of rosters) {
    for (const pid of roster.players ?? []) {
      const player = players[pid];
      if (player?.position === "DEF" && player.team) {
        map.set(`TEAM_${player.team}`, roster.rosterId);
      }
    }
  }

  return map;
}
