import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import axios, { AxiosError } from "axios";
import type {
  Group,
  GroupClaim,
  GroupClaimSummary,
  GroupDetailResponse,
} from "../types/group";

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

export function useGroupsForLeague(
  leagueProvider: string,
  leagueId: string | null,
) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["groups", leagueProvider, leagueId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<{ groups: Group[] }>("/api/groups", {
        params: { leagueProvider, leagueId },
        headers: authHeader(token),
      });
      return res.data.groups;
    },
    enabled: !!leagueId,
    staleTime: 30 * 1000,
  });
}

export function useGroupDetail(groupId: string | null) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<GroupDetailResponse>(
        `/api/groups/${groupId}`,
        {
          headers: authHeader(token),
        },
      );
      return res.data;
    },
    enabled: !!groupId,
    staleTime: 15 * 1000,
  });
}

export function useGroupPendingClaims(
  groupId: string | null,
  isCommissioner: boolean,
) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["group-claims", groupId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<{ claims: GroupClaimSummary[] }>(
        `/api/groups/${groupId}/claims`,
        {
          headers: authHeader(token),
        },
      );
      return res.data.claims;
    },
    enabled: !!groupId && isCommissioner,
    staleTime: 15 * 1000,
  });
}

// ---- Mutations ----

export function useCreateGroup() {
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
        const res = await axios.post<{ group: Group }>("/api/groups", input, {
          headers: authHeader(token),
        });
        return res.data.group;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to create group"));
      }
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({
        queryKey: ["groups", group.leagueProvider, group.leagueId],
      });
    },
  });
}

export function useSubmitClaim() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      groupId: string;
      inviteCode: string;
      rosterId: number;
      message?: string;
    }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ claim: GroupClaim }>(
          `/api/groups/${input.groupId}/claims`,
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
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] });
      queryClient.invalidateQueries({
        queryKey: ["group-claims", variables.groupId],
      });
    },
  });
}

export function useDecideClaim() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      groupId: string;
      claimId: string;
      decision: "approved" | "rejected";
    }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ claim: GroupClaim }>(
          `/api/groups/${input.groupId}/claims/${input.claimId}/decide`,
          { decision: input.decision },
          { headers: authHeader(token) },
        );
        return res.data.claim;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to update claim"));
      }
    },
    onSuccess: (_claim, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] });
      queryClient.invalidateQueries({
        queryKey: ["group-claims", variables.groupId],
      });
    },
  });
}

export function useRevokeClaim() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string; claimId: string }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ claim: GroupClaim }>(
          `/api/groups/${input.groupId}/claims/${input.claimId}/revoke`,
          {},
          { headers: authHeader(token) },
        );
        return res.data.claim;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to revoke team owner"));
      }
    },
    onSuccess: (_claim, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] });
      queryClient.invalidateQueries({
        queryKey: ["group-claims", variables.groupId],
      });
    },
  });
}

export function usePromoteCommissioner() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      groupId: string;
      newCommissionerUserId: string;
    }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ group: Group }>(
          `/api/groups/${input.groupId}/promote`,
          { newCommissionerUserId: input.newCommissionerUserId },
          { headers: authHeader(token) },
        );
        return res.data.group;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to promote commissioner"));
      }
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["group", group.id] });
      queryClient.invalidateQueries({ queryKey: ["group-claims", group.id] });
    },
  });
}

export function useRotateInviteCode() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ group: Group }>(
          `/api/groups/${input.groupId}/rotate-code`,
          {},
          { headers: authHeader(token) },
        );
        return res.data.group;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to rotate invite code"));
      }
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["group", group.id] });
      queryClient.invalidateQueries({
        queryKey: ["groups", group.leagueProvider, group.leagueId],
      });
    },
  });
}

export function useUpdateGroup() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string; name?: string }) => {
      const token = await getToken();
      try {
        const res = await axios.patch<{ group: Group }>(
          `/api/groups/${input.groupId}`,
          { name: input.name },
          { headers: authHeader(token) },
        );
        return res.data.group;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to update group"));
      }
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["group", group.id] });
      queryClient.invalidateQueries({
        queryKey: ["groups", group.leagueProvider, group.leagueId],
      });
    },
  });
}

export function useDeleteGroup() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      groupId: string;
      leagueProvider: string;
      leagueId: string;
    }) => {
      const token = await getToken();
      try {
        await axios.delete(`/api/groups/${input.groupId}`, {
          headers: authHeader(token),
        });
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to delete group"));
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["groups", variables.leagueProvider, variables.leagueId],
      });
    },
  });
}

export function useLookupGroupByCode() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (input: { code: string }) => {
      const token = await getToken();
      try {
        const res = await axios.get<{ group: Group }>("/api/groups/lookup", {
          params: { code: input.code.toUpperCase() },
          headers: authHeader(token),
        });
        return res.data.group;
      } catch (err) {
        throw new Error(errorMessage(err, "Group not found"));
      }
    },
  });
}
