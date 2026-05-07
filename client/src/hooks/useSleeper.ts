import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '@clerk/clerk-react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setSyncedLeagueIds } from '../store/slices/authSlice'
import type { League, Roster, TeamUser, Matchup, Player, NFLState, Transaction, TradedPick, PlayoffMatchup, Draft, DraftPick } from '../types/fantasy'

const PROVIDER = 'sleeper'
const base = (path: string) => `/api/provider/${PROVIDER}${path}`

// ---- Leagues (current year) ----

export function useSleeperLeagues() {
  const sleeperUserId = useAppSelector(state => state.auth.user?.sleeperUserId)
  const year = useAppSelector(state => state.auth.selectedYear)

  return useQuery({
    queryKey: ['sleeper-leagues', sleeperUserId, year],
    queryFn: async () => {
      const res = await axios.get<{ leagues: League[] }>(base(`/user/${sleeperUserId}/leagues/${year}`))
      return res.data.leagues
    },
    enabled: !!sleeperUserId,
    staleTime: 5 * 60 * 1000,
  })
}

// ---- All leagues across all seasons ----

export function useAllSleeperLeagues() {
  const sleeperUserId = useAppSelector(state => state.auth.user?.sleeperUserId)

  return useQuery({
    queryKey: ['sleeper-leagues-all', sleeperUserId],
    queryFn: async () => {
      const res = await axios.get<{ leagues: League[] }>(base(`/user/${sleeperUserId}/leagues`))
      return res.data.leagues
    },
    enabled: !!sleeperUserId,
    staleTime: 10 * 60 * 1000,
  })
}

// ---- League detail ----

export function useLeague(leagueId: string | null) {
  return useQuery({
    queryKey: ['sleeper-league', leagueId],
    queryFn: async () => {
      const res = await axios.get<{ league: League }>(base(`/league/${leagueId}`))
      return res.data.league
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  })
}

// ---- Rosters ----

export function useLeagueRosters(leagueId: string | null) {
  return useQuery({
    queryKey: ['sleeper-rosters', leagueId],
    queryFn: async () => {
      const res = await axios.get<{ rosters: Roster[] }>(base(`/league/${leagueId}/rosters`))
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
      const res = await axios.get<{ users: TeamUser[] }>(base(`/league/${leagueId}/users`))
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
      const res = await axios.get<{ matchups: Matchup[] }>(base(`/league/${leagueId}/matchups/${week}`))
      return res.data.matchups
    },
    enabled: !!leagueId && week >= 1,
    staleTime: 2 * 60 * 1000,
  })
}

// ---- Players ----

export function useNFLPlayers() {
  return useQuery({
    queryKey: ['nfl-players'],
    queryFn: async () => {
      const res = await axios.get<{ players: Record<string, Player> }>(base('/players'))
      return res.data.players
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })
}

// ---- NFL State (current week/season) ----
export function useNFLState() {
  return useQuery({
    queryKey: ['provider-state', PROVIDER],
    queryFn: async () => {
      const res = await axios.get<{ state: NFLState }>(base('/state'))
      return res.data.state
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}

// ---- Transactions ----
export function useLeagueTransactions(leagueId: string | null, week: number | null) {
  return useQuery({
    queryKey: ['provider-transactions', PROVIDER, leagueId, week],
    queryFn: async () => {
      const res = await axios.get<{ transactions: Transaction[] }>(
        base(`/league/${leagueId}/transactions/${week}`)
      )
      return res.data.transactions
    },
    enabled: !!leagueId && !!week && week >= 1,
    staleTime: 5 * 60 * 1000,
  })
}

// ---- Traded Picks ----
export function useTradedPicks(leagueId: string | null) {
  return useQuery({
    queryKey: ['provider-traded-picks', PROVIDER, leagueId],
    queryFn: async () => {
      const res = await axios.get<{ picks: TradedPick[] }>(
        base(`/league/${leagueId}/traded_picks`)
      )
      return res.data.picks
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  })
}

// ---- Winners Bracket ----
export function useWinnersBracket(leagueId: string | null) {
  return useQuery({
    queryKey: ['provider-winners-bracket', PROVIDER, leagueId],
    queryFn: async () => {
      const res = await axios.get<{ bracket: PlayoffMatchup[] }>(
        base(`/league/${leagueId}/winners_bracket`)
      )
      return res.data.bracket
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  })
}

// ---- Losers Bracket ----
export function useLosersBracket(leagueId: string | null) {
  return useQuery({
    queryKey: ['provider-losers-bracket', PROVIDER, leagueId],
    queryFn: async () => {
      const res = await axios.get<{ bracket: PlayoffMatchup[] }>(
        base(`/league/${leagueId}/losers_bracket`)
      )
      return res.data.bracket
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  })
}

// ---- Draft ----
export function useDraft(draftId: string | null) {
  return useQuery({
    queryKey: ['provider-draft', PROVIDER, draftId],
    queryFn: async () => {
      const res = await axios.get<{ draft: Draft }>(
        base(`/draft/${draftId}`)
      )
      return res.data.draft
    },
    enabled: !!draftId,
    staleTime: 60 * 60 * 1000,
  })
}

// ---- Draft Picks ----
export function useDraftPicks(draftId: string | null) {
  return useQuery({
    queryKey: ['provider-draft-picks', PROVIDER, draftId],
    queryFn: async () => {
      const res = await axios.get<{ picks: DraftPick[] }>(
        base(`/draft/${draftId}/picks`)
      )
      return res.data.picks
    },
    enabled: !!draftId,
    staleTime: 60 * 60 * 1000,
  })
}

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
