/**
 * Win % power ranking.
 *
 * Placeholder algorithm — scores teams by their win percentage.
 * Serves as a reference implementation for plugging in more sophisticated
 * algorithms later (e.g. ELO, SOS-adjusted, all-play record).
 */
import { registerAlgorithm } from "../services/powerRankingsService.js";
import type { PowerRankingInput } from "../services/powerRankingsService.js";

registerAlgorithm({
  id: "win_pct",
  label: "Win %",
  description: "Win percentage (W / GP). Ties count as 0.5 wins.",
  compute({ rosters }: PowerRankingInput): Map<number, number> {
    const scores = new Map<number, number>();
    for (const roster of rosters) {
      const { wins = 0, losses = 0, ties = 0 } = roster.record ?? {};
      const gp = wins + losses + ties;
      scores.set(roster.rosterId, gp === 0 ? 0 : (wins + ties * 0.5) / gp);
    }
    return scores;
  },
});
