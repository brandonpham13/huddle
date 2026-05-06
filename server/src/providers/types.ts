import type {
  ConnectedAccount,
  League,
  Matchup,
  Player,
  ProviderId,
  Roster,
  TeamUser,
} from '../domain/fantasy.js'

// Adapter contract every fantasy platform implements. Methods may throw
// errors with a numeric `status` field (404, 502) for the route layer to
// translate to HTTP responses.
export interface FantasyProvider {
  readonly id: ProviderId

  /** Look up an account by the user's handle on this platform. */
  getAccount(username: string): Promise<ConnectedAccount | null>

  /** Every league the account has participated in, across all seasons. */
  getUserLeagues(userId: string): Promise<League[]>

  /** Walks the prior-season chain for one league, most recent first. */
  getLeagueHistory(leagueId: string): Promise<League[]>

  getLeague(leagueId: string): Promise<League>
  getRosters(leagueId: string): Promise<Roster[]>
  getLeagueUsers(leagueId: string): Promise<TeamUser[]>
  getMatchups(leagueId: string, week: number): Promise<Matchup[]>

  /**
   * Provider-wide player dictionary. Optional — providers that don't expose
   * a single global list can omit this and widgets will fall back per-roster.
   */
  getPlayers?(): Promise<Record<string, Player>>
}
