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
 * "DEF" — emitting a "TEAM_<abbr>" → rosterId entry. The result can be used
 * alongside a normal playerId → rosterId map when matching stats entries to
 * their owning rosters.
 */

import type { Roster } from "../types/fantasy";

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
