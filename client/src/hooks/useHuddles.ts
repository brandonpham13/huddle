import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import axios, { AxiosError } from "axios";
import type {
  Huddle,
  HuddleClaim,
  HuddleClaimSummary,
  HuddleDetailResponse,
} from "../types/huddle";

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

// ---- Queries ----

export function useHuddlesForLeague(
  leagueProvider: string,
  leagueId: string | null,
) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["huddles", leagueProvider, leagueId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<{ huddles: Huddle[] }>("/api/huddles", {
        params: { leagueProvider, leagueId },
        headers: authHeader(token),
      });
      return res.data.huddles;
    },
    enabled: !!leagueId,
    staleTime: 30 * 1000,
  });
}

export function useHuddleDetail(huddleId: string | null) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["huddle", huddleId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<HuddleDetailResponse>(
        `/api/huddles/${huddleId}`,
        { headers: authHeader(token) },
      );
      return res.data;
    },
    enabled: !!huddleId,
    staleTime: 15 * 1000,
  });
}

export function useHuddlePendingClaims(
  huddleId: string | null,
  isCommissioner: boolean,
) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["huddle-claims", huddleId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<{ claims: HuddleClaimSummary[] }>(
        `/api/huddles/${huddleId}/claims`,
        { headers: authHeader(token) },
      );
      return res.data.claims;
    },
    enabled: !!huddleId && isCommissioner,
    staleTime: 15 * 1000,
  });
}

// ---- Mutations ----

export function useCreateHuddle() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      leagueProvider: string;
      leagueId: string;
      name: string;
      rosterId?: number;
    }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ huddle: Huddle }>(
          "/api/huddles",
          input,
          { headers: authHeader(token) },
        );
        return res.data.huddle;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to create huddle"));
      }
    },
    onSuccess: (huddle) => {
      queryClient.invalidateQueries({
        queryKey: ["huddles", huddle.leagueProvider, huddle.leagueId],
      });
    },
  });
}

export function useSubmitClaim() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      huddleId: string;
      inviteCode: string;
      rosterId: number;
      message?: string;
    }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ claim: HuddleClaim }>(
          `/api/huddles/${input.huddleId}/claims`,
          {
            inviteCode: input.inviteCode,
            rosterId: input.rosterId,
            message: input.message,
          },
          { headers: authHeader(token) },
        );
        return res.data.claim;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to submit claim"));
      }
    },
    onSuccess: (_claim, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["huddle", variables.huddleId],
      });
      queryClient.invalidateQueries({
        queryKey: ["huddle-claims", variables.huddleId],
      });
    },
  });
}

export function useDecideClaim() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      huddleId: string;
      claimId: string;
      decision: "approved" | "rejected";
    }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ claim: HuddleClaim }>(
          `/api/huddles/${input.huddleId}/claims/${input.claimId}/decide`,
          { decision: input.decision },
          { headers: authHeader(token) },
        );
        return res.data.claim;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to update claim"));
      }
    },
    onSuccess: (_claim, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["huddle", variables.huddleId],
      });
      queryClient.invalidateQueries({
        queryKey: ["huddle-claims", variables.huddleId],
      });
    },
  });
}

export function useUpdateHuddle() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; name?: string }) => {
      const token = await getToken();
      try {
        const res = await axios.patch<{ huddle: Huddle }>(
          `/api/huddles/${input.huddleId}`,
          { name: input.name },
          { headers: authHeader(token) },
        );
        return res.data.huddle;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to update huddle"));
      }
    },
    onSuccess: (huddle) => {
      queryClient.invalidateQueries({ queryKey: ["huddle", huddle.id] });
      queryClient.invalidateQueries({
        queryKey: ["huddles", huddle.leagueProvider, huddle.leagueId],
      });
    },
  });
}

export function useRotateInviteCode() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ huddle: Huddle }>(
          `/api/huddles/${input.huddleId}/rotate-code`,
          {},
          { headers: authHeader(token) },
        );
        return res.data.huddle;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to rotate invite code"));
      }
    },
    onSuccess: (huddle) => {
      queryClient.invalidateQueries({ queryKey: ["huddle", huddle.id] });
      queryClient.invalidateQueries({
        queryKey: ["huddles", huddle.leagueProvider, huddle.leagueId],
      });
    },
  });
}

export function useLookupHuddleByCode() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (input: { code: string }) => {
      const token = await getToken();
      try {
        const res = await axios.get<{ huddle: Huddle }>("/api/huddles/lookup", {
          params: { code: input.code.toUpperCase() },
          headers: authHeader(token),
        });
        return res.data.huddle;
      } catch (err) {
        throw new Error(errorMessage(err, "Huddle not found"));
      }
    },
  });
}

export function useDeleteHuddle() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      huddleId: string;
      leagueProvider: string;
      leagueId: string;
    }) => {
      const token = await getToken();
      try {
        await axios.delete(`/api/huddles/${input.huddleId}`, {
          headers: authHeader(token),
        });
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to delete huddle"));
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["huddles", variables.leagueProvider, variables.leagueId],
      });
    },
  });
}

export function useAddCommissioner() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; newUserId: string }) => {
      const token = await getToken();
      try {
        const res = await axios.post(
          `/api/huddles/${input.huddleId}/commissioners`,
          { newUserId: input.newUserId },
          { headers: authHeader(token) },
        );
        return res.data;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to add commissioner"));
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["huddle", variables.huddleId],
      });
    },
  });
}

export function useRemoveCommissioner() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; targetUserId: string }) => {
      const token = await getToken();
      try {
        await axios.delete(
          `/api/huddles/${input.huddleId}/commissioners/${input.targetUserId}`,
          { headers: authHeader(token) },
        );
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to remove commissioner"));
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["huddle", variables.huddleId],
      });
    },
  });
}
