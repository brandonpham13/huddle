// Client-side domain types — mirror server/src/domain/fantasy.ts.
// Widgets and hooks should only ever use these types, never provider-specific raw shapes.

export type ProviderId = "sleeper" | "espn" | "yahoo";

export interface LeagueRef {
  provider: ProviderId;
  leagueId: string;
}

export interface League {
  ref: LeagueRef;
  name: string;
  season: string;
  status: string;
  totalRosters: number;
  sport: string;
  avatar: string | null;
  previousLeagueRef: LeagueRef | null;
}

export interface Roster {
  rosterId: number;
  ownerId: string | null;
  leagueId: string;
  players: string[];
  starters: string[];
  reserve: string[];
  record: { wins: number; losses: number; ties: number };
  pointsFor: number;
  pointsAgainst: number;
}

export interface TeamUser {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  teamName: string | null;
  isOwner: boolean;
}

export interface Matchup {
  rosterId: number;
  matchupId: number | null;
  points: number;
  starters: string[];
  players: string[];
}

export interface Player {
  playerId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string;
  team: string | null;
  status: string;
  injuryStatus: string | null;
}

export interface NFLState {
  week: number;
  season: string;
  season_type: "pre" | "regular" | "post";
  league_create_season: string;
  display_week: number;
  season_start_date: string;
}

export type TransactionType = "waiver" | "free_agent" | "trade";
export type TransactionStatus = "complete" | "failed" | "pending";

export interface Transaction {
  transaction_id: string;
  type: TransactionType;
  status: TransactionStatus;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: TradedPick[];
  waiver_budget: Array<{ sender: number; receiver: number; amount: number }>;
  created: number;
  status_updated: number;
  leg: number;
  consenter_ids: number[];
}

export interface TradedPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

export interface PlayoffMatchup {
  round: number;
  matchup_id: number;
  team1_roster_id: number | null;
  team2_roster_id: number | null;
  winner_roster_id: number | null;
  loser_roster_id: number | null;
  place: number | null;
  team1_from: { winner_of?: number; loser_of?: number } | null;
  team2_from: { winner_of?: number; loser_of?: number } | null;
}

export interface Draft {
  draft_id: string;
  league_id: string;
  season: string;
  status: "pre_draft" | "drafting" | "complete" | "paused";
  type: "snake" | "auction" | "linear";
  sport: string;
  settings: {
    teams: number;
    rounds: number;
    pick_timer: number;
    cpu_autopick: boolean;
    reversal_round: number;
    player_type: number;
    budget: number;
    nominate_count: number;
    reserve_rounds: number;
    slots_wr: number;
    slots_rb: number;
    slots_qb: number;
    slots_te: number;
    slots_flex: number;
    slots_def: number;
    slots_k: number;
    slots_bn: number;
  };
  slot_to_roster_id: Record<string, number>;
  draft_order: Record<string, number> | null;
  created: number;
  updated: number;
  start_time: number;
  last_picked: number;
}

export interface DraftPick {
  round: number;
  roster_id: number;
  player_id: string;
  picked_by: string;
  pick_no: number;
  metadata: {
    team: string;
    status: string;
    sport: string;
    position: string;
    player_id: string;
    number: string;
    news_updated: string;
    last_name: string;
    injury_status: string;
    first_name: string;
  };
  is_keeper: boolean | null;
  draft_id: string;
}

// ---- Player stats ----

/**
 * Per-player fantasy stats for a single week.
 * The most useful keys are pts_ppr, pts_std, pts_half_ppr for fantasy totals.
 * All other keys are raw stat buckets (rush_yd, rec_td, pass_att, etc).
 */
export interface PlayerStats {
  [stat: string]: number;
}

/** Map of playerId -> stats for a given week */
export type PlayerStatsMap = Record<string, PlayerStats>;
