// Client-side domain types — mirror server/src/domain/fantasy.ts.
// Widgets and hooks should only ever use these types, never provider-specific raw shapes.

export type ProviderId = 'sleeper' | 'espn' | 'yahoo'

export interface LeagueRef {
  provider: ProviderId
  leagueId: string
}

export interface League {
  ref: LeagueRef
  name: string
  season: string
  status: string
  totalRosters: number
  sport: string
  avatar: string | null
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
