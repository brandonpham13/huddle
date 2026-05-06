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
  previous_league_id?: string | null
  scoring_settings?: Record<string, number>
  roster_positions?: string[]
  settings?: Record<string, unknown>
}

export interface SleeperRoster {
  roster_id: number
  owner_id: string | null
  league_id: string
  players: string[] | null
  starters: string[] | null
  reserve: string[] | null
  settings: {
    wins: number
    losses: number
    ties: number
    fpts: number
    fpts_decimal: number
    fpts_against: number
    fpts_against_decimal: number
    waiver_position: number
    waiver_budget_used: number
    total_moves: number
  }
}

export interface SleeperLeagueUser {
  user_id: string
  username: string
  display_name: string
  avatar: string | null
  metadata?: { team_name?: string }
  is_owner?: boolean
}

export interface SleeperMatchup {
  roster_id: number
  matchup_id: number | null
  points: number
  custom_points: number | null
  starters: string[]
  players: string[]
}

export interface SleeperPlayer {
  player_id: string
  first_name: string
  last_name: string
  full_name?: string
  position: string
  fantasy_positions?: string[]
  team: string | null
  status: string
  age?: number
  number?: number
  depth_chart_position?: number
  injury_status?: string | null
  avatar?: string | null
}

// In-memory player cache — shared across all users, 24hr TTL
let playerCache: Record<string, SleeperPlayer> | null = null
let playerCacheExpiry = 0

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (res.status === 404) throw Object.assign(new Error('Not found'), { status: 404 })
  if (!res.ok) throw Object.assign(new Error(`Sleeper API error: ${res.status}`), { status: res.status })
  return res.json() as Promise<T>
}

export async function getSleeperUser(username: string): Promise<SleeperUser | null> {
  try {
    const data = await fetchJson<SleeperUser>(`${SLEEPER_BASE}/user/${encodeURIComponent(username)}`)
    return data ?? null
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return null
    throw err
  }
}

export async function getSleeperLeagues(userId: string, year: string): Promise<SleeperLeague[]> {
  try {
    const data = await fetchJson<SleeperLeague[]>(`${SLEEPER_BASE}/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(year)}`)
    return data ?? []
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return []
    throw err
  }
}

export async function getLeague(leagueId: string): Promise<SleeperLeague> {
  return fetchJson<SleeperLeague>(`${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}`)
}

export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  return fetchJson<SleeperRoster[]>(`${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}/rosters`)
}

export async function getLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
  return fetchJson<SleeperLeagueUser[]>(`${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}/users`)
}

export async function getLeagueMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  return fetchJson<SleeperMatchup[]>(`${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}/matchups/${week}`)
}

export async function getNFLPlayers(): Promise<Record<string, SleeperPlayer>> {
  const now = Date.now()
  if (playerCache && now < playerCacheExpiry) {
    return playerCache
  }
  const data = await fetchJson<Record<string, SleeperPlayer>>(`${SLEEPER_BASE}/players/nfl`)
  playerCache = data
  playerCacheExpiry = now + 24 * 60 * 60 * 1000 // 24hr
  return data
}
