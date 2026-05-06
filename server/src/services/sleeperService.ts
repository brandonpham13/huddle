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
