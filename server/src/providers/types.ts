import type {
  ConnectedAccount,
  Draft,
  DraftPick,
  League,
  Matchup,
  NFLState,
  Player,
  PlayoffMatchup,
  ProviderId,
  Roster,
  TeamUser,
  TradedPick,
  Transaction,
} from "../domain/fantasy.js";

// Adapter contract every fantasy platform implements. Methods may throw
// errors with a numeric `status` field (404, 502) for the route layer to
// translate to HTTP responses.
export interface FantasyProvider {
  readonly id: ProviderId;

  /** Look up an account by the user's handle on this platform. */
  getAccount(username: string): Promise<ConnectedAccount | null>;

  /** Leagues the account participated in for a specific season. */
  getUserLeagues(userId: string, year: string): Promise<League[]>;

  /** Every league the account has ever been in, across all seasons. */
  getAllUserLeagues(userId: string): Promise<League[]>;

  /** Walks the prior-season chain for one league, most recent first. */
  getLeagueHistory(leagueId: string): Promise<League[]>;

  getLeague(leagueId: string): Promise<League>;
  getRosters(leagueId: string): Promise<Roster[]>;
  getLeagueUsers(leagueId: string): Promise<TeamUser[]>;
  getMatchups(leagueId: string, week: number): Promise<Matchup[]>;

  /**
   * Provider-wide player dictionary. Optional — providers that don't expose
   * a single global list can omit this and widgets will fall back per-roster.
   */
  getPlayers?(): Promise<Record<string, Player>>;

  /** Current NFL state — week number, season type, etc. */
  getNFLState?(): Promise<NFLState>;

  /** Transactions for a specific week (adds, drops, trades, waivers). */
  getTransactions?(leagueId: string, week: number): Promise<Transaction[]>;

  /** All traded draft picks in a league. */
  getTradedPicks?(leagueId: string): Promise<TradedPick[]>;

  /** Winners (playoff) bracket. */
  getWinnersBracket?(leagueId: string): Promise<PlayoffMatchup[]>;

  /** Losers (consolation) bracket. */
  getLosersBracket?(leagueId: string): Promise<PlayoffMatchup[]>;

  /** Draft metadata for a specific draft. */
  getDraft?(draftId: string): Promise<Draft>;

  /** All picks in a draft. */
  getDraftPicks?(draftId: string): Promise<DraftPick[]>;

  /**
   * Per-player fantasy stats for a given season + week.
   * Returns a map of playerId -> stat object including pts_ppr / pts_std / pts_half_ppr.
   */
  getPlayerStats?(
    season: string,
    week: number,
  ): Promise<Record<string, Record<string, number | string>>>;
}
