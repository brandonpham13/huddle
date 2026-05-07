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

export interface SleeperNFLState {
  week: number
  season: string
  season_type: 'pre' | 'regular' | 'post'
  league_create_season: string
  display_week: number
  season_start_date: string
}

export type TransactionType = 'waiver' | 'free_agent' | 'trade'
export type TransactionStatus = 'complete' | 'failed' | 'pending'

export interface SleeperTransaction {
  transaction_id: string
  type: TransactionType
  status: TransactionStatus
  roster_ids: number[]
  adds: Record<string, number> | null
  drops: Record<string, number> | null
  draft_picks: SleeperTradedPick[]
  waiver_budget: Array<{ sender: number; receiver: number; amount: number }>
  created: number
  status_updated: number
  leg: number
  consenter_ids: number[]
}

export interface SleeperTradedPick {
  season: string
  round: number
  roster_id: number
  previous_owner_id: number
  owner_id: number
}

export interface SleeperPlayoffMatchup {
  r: number
  m: number
  t1: number | null
  t2: number | null
  w: number | null
  l: number | null
  p?: number
  t1_from?: { w?: number; l?: number }
  t2_from?: { w?: number; l?: number }
}

export interface SleeperDraft {
  draft_id: string
  league_id: string
  season: string
  status: 'pre_draft' | 'drafting' | 'complete' | 'paused'
  type: 'snake' | 'auction' | 'linear'
  sport: string
  settings: Record<string, unknown>
  slot_to_roster_id: Record<string, number>
  draft_order: Record<string, number> | null
  created: number
  updated: number
  start_time: number
  last_picked: number
}

export interface SleeperDraftPick {
  round: number
  roster_id: number
  player_id: string
  picked_by: string
  pick_no: number
  metadata: Record<string, string>
  is_keeper: boolean | null
  draft_id: string
}
