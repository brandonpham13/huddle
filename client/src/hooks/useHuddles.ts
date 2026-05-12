/**
 * Huddle API client hooks.
 *
 * A "huddle" is Huddle's own concept — a group of friends sharing a fantasy
 * league, with membership via team **claims**. Huddles are now created
 * independently of a league; a commissioner links a league later via the
 * huddle settings page.
 */
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

/** All huddles the current user belongs to (commissioner or approved claim). */
export function useMyHuddles() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["huddles"],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<{ huddles: Huddle[] }>("/api/huddles", {
        headers: authHeader(token),
      });
      return res.data.huddles;
    },
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
    mutationFn: async () => {
      const token = await getToken();
      try {
        const res = await axios.post<{ huddle: Huddle }>(
          "/api/huddles",
          {},
          { headers: authHeader(token) },
        );
        return res.data.huddle;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to create huddle"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["huddles"] });
    },
  });
}

export function useLinkLeague() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      huddleId: string;
      leagueProvider: string;
      leagueId: string;
      leagueName?: string;
    }) => {
      const token = await getToken();
      try {
        const res = await axios.patch<{ huddle: Huddle }>(
          `/api/huddles/${input.huddleId}/league`,
          { leagueProvider: input.leagueProvider, leagueId: input.leagueId, leagueName: input.leagueName },
          { headers: authHeader(token) },
        );
        return res.data.huddle;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to link league"));
      }
    },
    onSuccess: (_huddle, variables) => {
      queryClient.invalidateQueries({ queryKey: ["huddles"] });
      queryClient.invalidateQueries({ queryKey: ["huddle", variables.huddleId] });
    },
  });
}

export function useSubmitClaim() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      huddleId: string;
      rosterId: number;
      message?: string;
    }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ claim: HuddleClaim }>(
          `/api/huddles/${input.huddleId}/claims`,
          { rosterId: input.rosterId, message: input.message },
          { headers: authHeader(token) },
        );
        return res.data.claim;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to submit claim"));
      }
    },
    onSuccess: (_claim, variables) => {
      queryClient.invalidateQueries({ queryKey: ["huddle", variables.huddleId] });
      queryClient.invalidateQueries({ queryKey: ["huddle-claims", variables.huddleId] });
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
      queryClient.invalidateQueries({ queryKey: ["huddle", variables.huddleId] });
      queryClient.invalidateQueries({ queryKey: ["huddle-claims", variables.huddleId] });
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
      queryClient.invalidateQueries({ queryKey: ["huddles"] });
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
      queryClient.invalidateQueries({ queryKey: ["huddles"] });
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
        throw new Error(errorMessage(err, "No huddle found with that invite code"));
      }
    },
  });
}

export function useDeleteHuddle() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string }) => {
      const token = await getToken();
      try {
        await axios.delete(`/api/huddles/${input.huddleId}`, {
          headers: authHeader(token),
        });
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to delete huddle"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["huddles"] });
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
      queryClient.invalidateQueries({ queryKey: ["huddle", variables.huddleId] });
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
      queryClient.invalidateQueries({ queryKey: ["huddle", variables.huddleId] });
    },
  });
}

export function useRemoveClaim() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      huddleId: string;
      claimId: string;
      isCommissioner: boolean;
    }) => {
      const token = await getToken();
      const url = input.isCommissioner
        ? `/api/huddles/${input.huddleId}/claims/${input.claimId}/force`
        : `/api/huddles/${input.huddleId}/claims/${input.claimId}`;
      try {
        await axios.delete(url, { headers: authHeader(token) });
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to unclaim team"));
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["huddle", variables.huddleId] });
    },
  });
}

// ── Announcements ─────────────────────────────────────────────────────────────

import type { HuddleAnnouncement } from "../types/huddle";

/** Fetches announcements for a huddle, newest first. */
export function useAnnouncements(huddleId: string | null) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["huddle-announcements", huddleId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<{ announcements: HuddleAnnouncement[] }>(
        `/api/huddles/${huddleId}/announcements`,
        { headers: authHeader(token) },
      );
      return res.data.announcements;
    },
    enabled: !!huddleId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateAnnouncement() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; title: string; body: string }) => {
      const token = await getToken();
      const res = await axios.post<{ announcement: HuddleAnnouncement }>(
        `/api/huddles/${input.huddleId}/announcements`,
        { title: input.title, body: input.body },
        { headers: authHeader(token) },
      );
      return res.data.announcement;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["huddle-announcements", variables.huddleId] });
    },
  });
}

export function useDeleteAnnouncement() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; announcementId: string }) => {
      const token = await getToken();
      await axios.delete(`/api/huddles/${input.huddleId}/announcements/${input.announcementId}`, {
        headers: authHeader(token),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["huddle-announcements", variables.huddleId] });
    },
  });
}
