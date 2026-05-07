import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import axios, { AxiosError } from 'axios'
import type {
  Group,
  GroupClaim,
  GroupClaimSummary,
  GroupDetailResponse,
} from '../types/group'

function authHeader(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: string } | undefined
    return data?.error ?? err.message ?? fallback
  }
  return fallback
}

// ---- Queries ----

export function useGroupsForLeague(leagueProvider: string, leagueId: string | null) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['groups', leagueProvider, leagueId],
    queryFn: async () => {
      const token = await getToken()
      const res = await axios.get<{ groups: Group[] }>('/api/groups', {
        params: { leagueProvider, leagueId },
        headers: authHeader(token),
      })
      return res.data.groups
    },
    enabled: !!leagueId,
    staleTime: 30 * 1000,
  })
}

export function useGroupDetail(groupId: string | null) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const token = await getToken()
      const res = await axios.get<GroupDetailResponse>(`/api/groups/${groupId}`, {
        headers: authHeader(token),
      })
      return res.data
    },
    enabled: !!groupId,
    staleTime: 15 * 1000,
  })
}

export function useGroupPendingClaims(groupId: string | null, isCommissioner: boolean) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['group-claims', groupId],
    queryFn: async () => {
      const token = await getToken()
      const res = await axios.get<{ claims: GroupClaimSummary[] }>(`/api/groups/${groupId}/claims`, {
        headers: authHeader(token),
      })
      return res.data.claims
    },
    enabled: !!groupId && isCommissioner,
    staleTime: 15 * 1000,
  })
}

// ---- Mutations ----

export function useCreateGroup() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      leagueProvider: string
      leagueId: string
      name: string
      password: string
      rosterId?: number
    }) => {
      const token = await getToken()
      try {
        const res = await axios.post<{ group: Group }>('/api/groups', input, { headers: authHeader(token) })
        return res.data.group
      } catch (err) {
        throw new Error(errorMessage(err, 'Failed to create group'))
      }
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['groups', group.leagueProvider, group.leagueId] })
    },
  })
}

export function useSubmitClaim() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { groupId: string; password: string; rosterId: number; message?: string }) => {
      const token = await getToken()
      try {
        const res = await axios.post<{ claim: GroupClaim }>(
          `/api/groups/${input.groupId}/claims`,
          { password: input.password, rosterId: input.rosterId, message: input.message },
          { headers: authHeader(token) },
        )
        return res.data.claim
      } catch (err) {
        throw new Error(errorMessage(err, 'Failed to submit claim'))
      }
    },
    onSuccess: (_claim, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] })
      queryClient.invalidateQueries({ queryKey: ['group-claims', variables.groupId] })
    },
  })
}

export function useDecideClaim() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { groupId: string; claimId: string; decision: 'approved' | 'rejected' }) => {
      const token = await getToken()
      try {
        const res = await axios.post<{ claim: GroupClaim }>(
          `/api/groups/${input.groupId}/claims/${input.claimId}/decide`,
          { decision: input.decision },
          { headers: authHeader(token) },
        )
        return res.data.claim
      } catch (err) {
        throw new Error(errorMessage(err, 'Failed to update claim'))
      }
    },
    onSuccess: (_claim, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] })
      queryClient.invalidateQueries({ queryKey: ['group-claims', variables.groupId] })
    },
  })
}

export function useUpdateGroup() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { groupId: string; name?: string; password?: string }) => {
      const token = await getToken()
      try {
        const res = await axios.patch<{ group: Group }>(
          `/api/groups/${input.groupId}`,
          { name: input.name, password: input.password },
          { headers: authHeader(token) },
        )
        return res.data.group
      } catch (err) {
        throw new Error(errorMessage(err, 'Failed to update group'))
      }
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['group', group.id] })
      queryClient.invalidateQueries({ queryKey: ['groups', group.leagueProvider, group.leagueId] })
    },
  })
}

export function useDeleteGroup() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { groupId: string; leagueProvider: string; leagueId: string }) => {
      const token = await getToken()
      try {
        await axios.delete(`/api/groups/${input.groupId}`, { headers: authHeader(token) })
      } catch (err) {
        throw new Error(errorMessage(err, 'Failed to delete group'))
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.leagueProvider, variables.leagueId] })
    },
  })
}
