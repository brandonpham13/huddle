/**
 * Power Rankings client hook.
 *
 * Power Rankings columns are **server-driven** — each algorithm registers
 * itself via `registerAlgorithm()` in
 * `server/src/services/powerRankingsService.ts`, and this endpoint returns
 * the full set of columns + per-roster rows. The client widget
 * (`widgets/dashboard/PowerRankings.tsx`) renders one column per entry
 * without any client-side conditionals — adding a new algorithm requires
 * zero client changes.
 *
 * To add a column, see PLAYBOOK.md → "Adding a column to Power Rankings".
 */
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const PROVIDER = "sleeper";
const base = (path: string) => `/api/provider/${PROVIDER}${path}`;

/**
 * A single algorithm column. `displayMode` controls whether the cell
 * shows the raw score (`"score"`) or the derived rank as `#N`
 * (`"rank"`). The Power Rankings widget reads the matching field from
 * `PowerRankingRow.scores` / `.ranks` based on this flag.
 */
export interface PowerRankingColumn {
  id: string;
  label: string;
  description: string;
  displayMode: "score" | "rank";
}

/**
 * One row per roster. `scores` and `ranks` are keyed by column id (so
 * column "all_play" lives at `row.scores["all_play"]` and the per-column
 * rank at `row.ranks["all_play"]`). `overallRank` is the composite rank
 * computed server-side from the registered algorithms.
 */
export interface PowerRankingRow {
  rosterId: number;
  teamName: string;
  avatar: string | null;
  scores: Record<string, number | null>;
  ranks: Record<string, number | null>;
  overallRank: number;
}

export interface PowerRankingsResult {
  columns: PowerRankingColumn[];
  rows: PowerRankingRow[];
}

export function usePowerRankings(leagueId: string | null) {
  return useQuery({
    queryKey: ["power-rankings", PROVIDER, leagueId],
    queryFn: async () => {
      const res = await axios.get<PowerRankingsResult>(
        base(`/league/${leagueId}/power-rankings`),
      );
      return res.data;
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  });
}
