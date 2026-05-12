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
  settings: Record<string, unknown>;
  /** Ordered roster slot types, e.g. ["QB","WR","WR","RB","FLEX","BN",...]. */
  rosterPositions: string[];
  /**
   * League scoring settings — maps stat keys to point multipliers.
   * e.g. { pass_yd: 0.04, pass_td: 4, rec: 1, bonus_rec_te: 0.5 }
   * Used to compute accurate fantasy points for custom-scoring leagues.
   */
  scoringSettings: Record<string, number>;
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
  /** Current W/L streak string from the provider — e.g. "3W", "2L".
   *  Null when the provider doesn't expose it (pre-draft / drafting
   *  leagues). Parsed for display in `widgets/dashboard/LeagueTable.tsx`. */
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
  /** Per-player fantasy points for this roster this week, keyed by player_id */
  playersPoints: Record<string, number> | null;
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

// ─── Team Stats (lifetime + per-season aggregates) ────────────────────────────

/** One row in the Season by Season table. */
export interface SeasonStat {
  leagueId: string;
  season: string;
  record: { wins: number; losses: number; ties: number };
  pointsFor: number;
  pointsAgainst: number;
  /** Final regular-season standing, 1-indexed. Null if unavailable. */
  seed: number | null;
  /** Postseason result for this season. Null = in-progress or unknown. */
  postseason:
    | "champion"
    | "runner_up"
    | "third"
    | "made_playoffs"
    | "missed_playoffs"
    | null;
  /** Placeholder — wired to power-rank data in a future pass. */
  powerRank: number | null;
}

/** One league-season slice of a head-to-head row (regular-season games counted). */
export interface H2HContribution {
  leagueId: string;
  season: string;
  games: number;
}

/** Head-to-head record against one specific opponent. */
export interface H2HRecord {
  opponentRosterId: number;
  opponentOwnerId: string | null;
  /** Display name for the opponent — team name if set, otherwise display name. */
  opponentTeamName: string | null;
  wins: number;
  losses: number;
  ties: number;
  /**
   * Which league seasons contributed regular-season H2H games to this row.
   * Populated by the team-stats API for tracing aggregate sources.
   */
  contributions: H2HContribution[];
}

/** Full lifetime + per-season statistics for one team. */
export interface TeamStats {
  careerRecord: { wins: number; losses: number; ties: number };
  winPct: number;
  playoffAppearances: number;
  championships: number;
  runnerUps: number;
  thirdPlace: number;
  avgFinish: number | null;

  avgPointsFor: number;
  avgPointsAgainst: number;
  highScore: {
    points: number;
    opponentPoints: number;
    opponentName: string | null;
    season: string;
    week: number;
    opponentRosterId: number | null;
  } | null;
  lowScore: {
    points: number;
    opponentPoints: number;
    opponentName: string | null;
    season: string;
    week: number;
    opponentRosterId: number | null;
  } | null;
  biggestWin: {
    margin: number;
    myPoints: number;
    opponentPoints: number;
    opponentName: string | null;
    season: string;
    week: number;
    opponentRosterId: number | null;
  } | null;
  worstLoss: {
    margin: number;
    myPoints: number;
    opponentPoints: number;
    opponentName: string | null;
    season: string;
    week: number;
    opponentRosterId: number | null;
  } | null;

  mvpWeeks: number;
  longestWinStreak: number;
  longestLossStreak: number;

  h2h: H2HRecord[];

  seasons: SeasonStat[];
}
