// Neutral, provider-agnostic domain model. Each FantasyProvider adapter is
// responsible for mapping its native shapes into these types. Widgets and
// routes should only ever see these.

export type ProviderId = "sleeper" | "espn" | "yahoo";

export interface LeagueRef {
  provider: ProviderId;
  leagueId: string;
}

export interface ConnectedAccount {
  provider: ProviderId;
  /** Provider-side username (display handle the user types). */
  username: string;
  /** Provider-side stable user id, if the provider exposes one. */
  userId: string;
}

export interface League {
  ref: LeagueRef;
  name: string;
  season: string;
  status: string;
  totalRosters: number;
  sport: string;
  avatar: string | null;
  /** Ref to the same league in the previous season, if linked by the provider. */
  previousLeagueRef: LeagueRef | null;
  /**
   * Provider-specific league settings. Typed loosely — consumers should
   * guard before accessing specific keys.
   * Useful keys (Sleeper): last_scored_leg, playoff_week_start
   */
  settings: Record<string, unknown>;
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
  /** Current W/L streak as Sleeper reports it — e.g. "3W", "2L". Null if
   *  the provider doesn't expose it (pre-draft / drafting leagues, or
   *  providers that simply don't track it). */
  streak: string | null;
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
  adds: Record<string, number> | null; // player_id -> roster_id
  drops: Record<string, number> | null; // player_id -> roster_id
  draft_picks: TradedPick[];
  waiver_budget: Array<{ sender: number; receiver: number; amount: number }>;
  created: number; // unix ms
  status_updated: number;
  leg: number; // week
  consenter_ids: number[];
}

export interface TradedPick {
  season: string;
  round: number;
  roster_id: number; // original owner
  previous_owner_id: number;
  owner_id: number; // current owner
}

export interface PlayoffMatchup {
  round: number;
  matchup_id: number;
  team1_roster_id: number | null;
  team2_roster_id: number | null;
  winner_roster_id: number | null;
  loser_roster_id: number | null;
  /** seeding place (only on consolation/3rd-place matchups) */
  place: number | null;
  /** source of team slot when not seeded directly */
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
  picked_by: string; // user_id
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
