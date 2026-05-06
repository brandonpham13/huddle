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
