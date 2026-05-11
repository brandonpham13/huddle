/**
 * Power Index — all-play win record.
 *
 * For each completed week, simulates every team playing every other team.
 * A team earns a win for each opponent they scored more points than that week.
 * The column displays each team's raw all-play win total; the widget derives
 * placement (1st, 2nd, …) from the sort order so the “#” column always reflects
 * true sequential position rather than a pre-computed float.
 */
import { registerAlgorithm } from "../services/powerRankingsService.js";
import type { PowerRankingInput } from "../services/powerRankingsService.js";

registerAlgorithm({
    id: "power_index",
    label: "Power",
    description:
        "All-play record: simulated wins if each team played every other team every week.",
    displayMode: "score",
    compute({
        rosters,
        matchupsByWeek,
    }: PowerRankingInput): Map<number, number> {
        const allPlayWins = new Map<number, number>(
            rosters.map((r) => [r.rosterId, 0]),
        );

        for (const weekMatchups of matchupsByWeek) {
            // Skip weeks with no data
            if (weekMatchups.length === 0) continue;

            // Build a score map for this week: rosterId → points
            const weekScores = new Map<number, number>();
            for (const m of weekMatchups) {
                weekScores.set(m.rosterId, m.points);
            }

            // For each team, count how many other teams they beat this week
            for (const [rosterId, score] of weekScores) {
                let wins = 0;
                for (const [otherId, otherScore] of weekScores) {
                    if (otherId !== rosterId && score > otherScore) wins++;
                }
                allPlayWins.set(
                    rosterId,
                    (allPlayWins.get(rosterId) ?? 0) + wins,
                );
            }
        }

        return allPlayWins;
    },
});
