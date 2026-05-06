import { useUser, useAuth } from '@clerk/clerk-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setSyncedLeagueIds } from '../store/slices/authSlice'

export interface SleeperLeague {
  league_id: string
  name: string
  season: string
  status: string
  total_rosters: number
  sport: string
  avatar: string | null
}

const CURRENT_YEAR = String(new Date().getFullYear() - 1)

async function fetchLeaguesForUser(username: string, year: string): Promise<SleeperLeague[]> {
  // Resolve username → userId
  const userRes = await fetch(`/api/sleeper/user/${encodeURIComponent(username)}`)
  if (!userRes.ok) return []
  const { user } = await userRes.json() as { user: { user_id: string } }

  // Fetch leagues
  const leaguesRes = await fetch(`/api/sleeper/user/${encodeURIComponent(user.user_id)}/leagues/${encodeURIComponent(year)}`)
  if (!leaguesRes.ok) return []
  const { leagues } = await leaguesRes.json() as { leagues: SleeperLeague[] }
  return leagues ?? []
}

export function useSleeperLeagues() {
  const { user } = useUser()
  const sleeperUsername = user?.unsafeMetadata?.sleeperUsername as string | null | undefined
  const year = useAppSelector(state => state.auth.selectedYear)

  return useQuery({
    queryKey: ['sleeper-leagues', sleeperUsername, year],
    queryFn: () => fetchLeaguesForUser(sleeperUsername!, year),
    enabled: !!sleeperUsername,
  })
}

export function useSyncLeagues() {
  const { getToken } = useAuth()
  const dispatch = useAppDispatch()

  return useMutation({
    mutationFn: async (leagueIds: string[]) => {
      const token = await getToken()
      const res = await fetch('/api/user/synced-leagues', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ syncedLeagueIds: leagueIds }),
      })
      if (!res.ok) throw new Error('Failed to sync leagues')
      return res.json() as Promise<{ syncedLeagueIds: string[] }>
    },
    onSuccess: (data) => {
      dispatch(setSyncedLeagueIds(data.syncedLeagueIds))
    },
  })
}
