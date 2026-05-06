// Neutral, provider-agnostic domain model. Each FantasyProvider adapter is
// responsible for mapping its native shapes into these types. Widgets and
// routes should only ever see these.

export type ProviderId = 'sleeper' | 'espn' | 'yahoo'

export interface LeagueRef {
  provider: ProviderId
  leagueId: string
}

export interface ConnectedAccount {
  provider: ProviderId
  /** Provider-side username (display handle the user types). */
  username: string
  /** Provider-side stable user id, if the provider exposes one. */
  userId: string
}

export interface League {
  ref: LeagueRef
  name: string
  season: string
  status: string
  totalRosters: number
  sport: string
  avatar: string | null
  /** Ref to the same league in the previous season, if linked by the provider. */
  previousLeagueRef: LeagueRef | null
}

export interface Roster {
  rosterId: number
  ownerId: string | null
  leagueId: string
  players: string[]
  starters: string[]
  reserve: string[]
  record: { wins: number; losses: number; ties: number }
  pointsFor: number
  pointsAgainst: number
}

export interface TeamUser {
  userId: string
  username: string
  displayName: string
  avatar: string | null
  teamName: string | null
  isOwner: boolean
}

export interface Matchup {
  rosterId: number
  matchupId: number | null
  points: number
  starters: string[]
  players: string[]
}

export interface Player {
  playerId: string
  firstName: string
  lastName: string
  fullName: string
  position: string
  team: string | null
  status: string
  injuryStatus: string | null
}
