import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '@clerk/clerk-react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setSyncedLeagueIds } from '../store/slices/authSlice'
import type { SleeperLeague, SleeperRoster, SleeperLeagueUser, SleeperMatchup, SleeperPlayer } from '../types/sleeper'

// ---- Leagues ----

export function useSleeperLeagues() {
  const sleeperUserId = useAppSelector(state => state.auth.user?.sleeperUserId)
  const year = useAppSelector(state => state.auth.selectedYear)

  return useQuery({
    queryKey: ['sleeper-leagues', sleeperUserId, year],
    queryFn: async () => {
      const res = await axios.get<{ leagues: SleeperLeague[] }>(`/api/sleeper/user/${sleeperUserId}/leagues/${year}`)
      return res.data.leagues
    },
    enabled: !!sleeperUserId,
    staleTime: 5 * 60 * 1000,
  })
}

// ---- League detail ----

export function useLeague(leagueId: string | null) {
  return useQuery({
    queryKey: ['sleeper-league', leagueId],
    queryFn: async () => {
      const res = await axios.get<{ league: SleeperLeague }>(`/api/sleeper/league/${leagueId}`)
      return res.data.league
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  })
}

// ---- League history (season chain) ----

export function useLeagueHistory(leagueId: string | null) {
  return useQuery({
    queryKey: ['sleeper-league-history', leagueId],
    queryFn: async () => {
      const res = await axios.get<{ history: Array<{ leagueId: string; season: string }> }>(`/api/sleeper/league/${leagueId}/history`)
      return res.data.history
    },
    enabled: !!leagueId,
    staleTime: 60 * 60 * 1000,
  })
}

// ---- Rosters ----

export function useLeagueRosters(leagueId: string | null) {
  return useQuery({
    queryKey: ['sleeper-rosters', leagueId],
    queryFn: async () => {
      const res = await axios.get<{ rosters: SleeperRoster[] }>(`/api/sleeper/league/${leagueId}/rosters`)
      return res.data.rosters
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  })
}

// ---- League users ----

export function useLeagueUsers(leagueId: string | null) {
  return useQuery({
    queryKey: ['sleeper-league-users', leagueId],
    queryFn: async () => {
      const res = await axios.get<{ users: SleeperLeagueUser[] }>(`/api/sleeper/league/${leagueId}/users`)
      return res.data.users
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  })
}

// ---- Matchups ----

export function useLeagueMatchups(leagueId: string | null, week: number) {
  return useQuery({
    queryKey: ['sleeper-matchups', leagueId, week],
    queryFn: async () => {
      const res = await axios.get<{ matchups: SleeperMatchup[] }>(`/api/sleeper/league/${leagueId}/matchups/${week}`)
      return res.data.matchups
    },
    enabled: !!leagueId && week >= 1,
    staleTime: 2 * 60 * 1000, // 2min — matchups change during game day
  })
}

// ---- Players ----

export function useNFLPlayers() {
  return useQuery({
    queryKey: ['nfl-players'],
    queryFn: async () => {
      const res = await axios.get<{ players: Record<string, SleeperPlayer> }>('/api/sleeper/players')
      return res.data.players
    },
    staleTime: 24 * 60 * 60 * 1000, // 24hr — matches server cache
    gcTime: 24 * 60 * 60 * 1000,
  })
}

// ---- Sync leagues mutation ----

export function useSyncLeagues() {
  const { getToken } = useAuth()
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (syncedLeagueIds: string[]) => {
      const token = await getToken()
      const res = await axios.patch<{ syncedLeagueIds: string[] }>(
        '/api/user/synced-leagues',
        { syncedLeagueIds },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return res.data.syncedLeagueIds
    },
    onSuccess: (syncedLeagueIds) => {
      dispatch(setSyncedLeagueIds(syncedLeagueIds))
      queryClient.invalidateQueries({ queryKey: ['sleeper-leagues'] })
    },
  })
}
