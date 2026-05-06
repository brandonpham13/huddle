import type { FantasyProvider } from '../types.js'
import type {
  ConnectedAccount,
  League,
  Matchup,
  Player,
  Roster,
  TeamUser,
} from '../../domain/fantasy.js'
import {
  getSleeperUser,
  getSleeperLeagues,
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getLeagueMatchups,
  getNFLPlayers,
} from '../../services/sleeperService.js'
import type {
  SleeperLeague,
  SleeperRoster,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperPlayer,
} from '../../services/sleeperService.js'

function toLeague(s: SleeperLeague): League {
  return {
    ref: { provider: 'sleeper', leagueId: s.league_id },
    name: s.name,
    season: s.season,
    status: s.status,
    totalRosters: s.total_rosters,
    sport: s.sport,
    avatar: s.avatar ?? null,
    previousLeagueRef: s.previous_league_id && s.previous_league_id !== '0'
      ? { provider: 'sleeper', leagueId: s.previous_league_id }
      : null,
  }
}

function toRoster(s: SleeperRoster): Roster {
  return {
    rosterId: s.roster_id,
    ownerId: s.owner_id,
    leagueId: s.league_id,
    players: s.players ?? [],
    starters: s.starters ?? [],
    reserve: s.reserve ?? [],
    record: { wins: s.settings.wins, losses: s.settings.losses, ties: s.settings.ties },
    pointsFor: s.settings.fpts + s.settings.fpts_decimal / 100,
    pointsAgainst: s.settings.fpts_against + s.settings.fpts_against_decimal / 100,
  }
}

function toTeamUser(s: SleeperLeagueUser): TeamUser {
  return {
    userId: s.user_id,
    username: s.username,
    displayName: s.display_name,
    avatar: s.avatar,
    teamName: s.metadata?.team_name ?? null,
    isOwner: s.is_owner ?? false,
  }
}

function toMatchup(s: SleeperMatchup): Matchup {
  return {
    rosterId: s.roster_id,
    matchupId: s.matchup_id,
    points: s.points,
    starters: s.starters,
    players: s.players,
  }
}

function toPlayer(id: string, s: SleeperPlayer): Player {
  return {
    playerId: id,
    firstName: s.first_name,
    lastName: s.last_name,
    fullName: s.full_name ?? `${s.first_name} ${s.last_name}`,
    position: s.position,
    team: s.team,
    status: s.status,
    injuryStatus: s.injury_status ?? null,
  }
}

export const sleeperProvider: FantasyProvider = {
  id: 'sleeper',

  async getAccount(username: string): Promise<ConnectedAccount | null> {
    const user = await getSleeperUser(username)
    if (!user) return null
    return { provider: 'sleeper', username: user.username, userId: user.user_id }
  },

  async getUserLeagues(userId: string): Promise<League[]> {
    const year = new Date().getFullYear().toString()
    const leagues = await getSleeperLeagues(userId, year)
    return leagues.map(toLeague)
  },

  async getLeagueHistory(leagueId: string): Promise<League[]> {
    const history: League[] = []
    let currentId: string | null = leagueId
    while (currentId) {
      const s = await getLeague(currentId)
      const league = toLeague(s)
      history.push(league)
      currentId = league.previousLeagueRef?.leagueId ?? null
    }
    return history
  },

  async getLeague(leagueId: string): Promise<League> {
    return toLeague(await getLeague(leagueId))
  },

  async getRosters(leagueId: string): Promise<Roster[]> {
    return (await getLeagueRosters(leagueId)).map(toRoster)
  },

  async getLeagueUsers(leagueId: string): Promise<TeamUser[]> {
    return (await getLeagueUsers(leagueId)).map(toTeamUser)
  },

  async getMatchups(leagueId: string, week: number): Promise<Matchup[]> {
    return (await getLeagueMatchups(leagueId, week)).map(toMatchup)
  },

  async getPlayers(): Promise<Record<string, Player>> {
    const raw = await getNFLPlayers()
    const result: Record<string, Player> = {}
    for (const [id, p] of Object.entries(raw)) {
      result[id] = toPlayer(id, p)
    }
    return result
  },
}
