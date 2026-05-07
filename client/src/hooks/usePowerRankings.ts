import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const PROVIDER = "sleeper";
const base = (path: string) => `/api/provider/${PROVIDER}${path}`;

export interface PowerRankingColumn {
  id: string;
  label: string;
  description: string;
}

export interface PowerRankingRow {
  rosterId: number;
  teamName: string;
  avatar: string | null;
  scores: Record<string, number | null>;
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
