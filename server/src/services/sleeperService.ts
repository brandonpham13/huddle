const SLEEPER_BASE = 'https://api.sleeper.app/v1'

export interface SleeperUser {
  user_id: string
  username: string
  display_name?: string
  avatar?: string | null
}

export interface SleeperLeague {
  league_id: string
  name: string
  season: string
  status: string
  total_rosters: number
  sport: string
  avatar?: string | null
}

export async function getSleeperUser(username: string): Promise<SleeperUser | null> {
  const res = await fetch(`${SLEEPER_BASE}/user/${encodeURIComponent(username)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Sleeper API error: ${res.status}`)
  const data = await res.json() as SleeperUser
  return data ?? null
}

export async function getSleeperLeagues(userId: string, year: string): Promise<SleeperLeague[]> {
  const res = await fetch(`${SLEEPER_BASE}/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(year)}`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Sleeper API error: ${res.status}`)
  const data = await res.json() as SleeperLeague[]
  return data ?? []
}

export interface SleeperRoster {
  roster_id: number
  owner_id: string | null
  settings?: {
    wins?: number
    losses?: number
    ties?: number
    fpts?: number
    fpts_decimal?: number
    fpts_against?: number
    fpts_against_decimal?: number
  }
}

export interface SleeperLeagueUser {
  user_id: string
  display_name: string
  avatar?: string | null
  metadata?: { team_name?: string }
}

export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  const res = await fetch(`${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}/rosters`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Sleeper API error: ${res.status}`)
  return (await res.json() as SleeperRoster[]) ?? []
}

export async function getLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
  const res = await fetch(`${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}/users`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Sleeper API error: ${res.status}`)
  return (await res.json() as SleeperLeagueUser[]) ?? []
}
