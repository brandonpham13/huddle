import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import axios, { AxiosError } from "axios";
import type { SideBet } from "../types/huddle";

function authHeader(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error ?? err.message ?? fallback;
  }
  return fallback;
}

/** All bets for a huddle, optionally filtered to a single week. */
export function useSideBets(huddleId: string | null, week?: number) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["side-bets", huddleId, week ?? null],
    queryFn: async () => {
      const token = await getToken();
      const params = week !== undefined ? { week } : {};
      const res = await axios.get<{ bets: SideBet[] }>(
        `/api/huddles/${huddleId}/bets`,
        { params, headers: authHeader(token) },
      );
      return res.data.bets;
    },
    enabled: !!huddleId,
    staleTime: 30 * 1000,
  });
}

export function useProposeBet() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      huddleId: string;
      opponentId: string;
      proposerRosterId?: number;
      opponentRosterId?: number;
      week: number;
      season: string;
      description: string;
      amount: number;
    }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ bet: SideBet }>(
          `/api/huddles/${input.huddleId}/bets`,
          {
            opponentId: input.opponentId,
            proposerRosterId: input.proposerRosterId,
            opponentRosterId: input.opponentRosterId,
            week: input.week,
            season: input.season,
            description: input.description,
            amount: input.amount,
          },
          { headers: authHeader(token) },
        );
        return res.data.bet;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to propose bet"));
      }
    },
    onSuccess: (_bet, variables) => {
      queryClient.invalidateQueries({ queryKey: ["side-bets", variables.huddleId] });
    },
  });
}

export function useRespondToBet() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      huddleId: string;
      betId: string;
      response: "accepted" | "rejected";
    }) => {
      const token = await getToken();
      try {
        const res = await axios.patch<{ bet: SideBet }>(
          `/api/huddles/${input.huddleId}/bets/${input.betId}`,
          { action: input.response },
          { headers: authHeader(token) },
        );
        return res.data.bet;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to respond to bet"));
      }
    },
    onSuccess: (_bet, variables) => {
      queryClient.invalidateQueries({ queryKey: ["side-bets", variables.huddleId] });
    },
  });
}

export function useCancelBet() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; betId: string }) => {
      const token = await getToken();
      try {
        const res = await axios.patch<{ bet: SideBet }>(
          `/api/huddles/${input.huddleId}/bets/${input.betId}`,
          { action: "cancelled" },
          { headers: authHeader(token) },
        );
        return res.data.bet;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to cancel bet"));
      }
    },
    onSuccess: (_bet, variables) => {
      queryClient.invalidateQueries({ queryKey: ["side-bets", variables.huddleId] });
    },
  });
}

export function useSettleBet() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      huddleId: string;
      betId: string;
      winnerId: string;
      settlementNote?: string;
    }) => {
      const token = await getToken();
      try {
        const res = await axios.patch<{ bet: SideBet }>(
          `/api/huddles/${input.huddleId}/bets/${input.betId}`,
          { action: "settled", winnerId: input.winnerId, settlementNote: input.settlementNote },
          { headers: authHeader(token) },
        );
        return res.data.bet;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to settle bet"));
      }
    },
    onSuccess: (_bet, variables) => {
      queryClient.invalidateQueries({ queryKey: ["side-bets", variables.huddleId] });
    },
  });
}
