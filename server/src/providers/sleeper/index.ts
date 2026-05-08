import type { FantasyProvider } from "../types.js";
import type {
  ConnectedAccount,
  Draft,
  DraftPick,
  League,
  Matchup,
  NFLState,
  Player,
  PlayoffMatchup,
  Roster,
  TeamUser,
  TradedPick,
  Transaction,
} from "../../domain/fantasy.js";
import {
  getSleeperUser,
  getSleeperLeagues,
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getLeagueMatchups,
  getNFLPlayers,
  getNFLState,
  getLeagueTransactions,
  getTradedPicks,
  getWinnersBracket,
  getLosersBracket,
  getDraft,
  getDraftPicks,
} from "../../services/sleeperService.js";
import type {
  SleeperLeague,
  SleeperRoster,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperPlayer,
  SleeperNFLState,
  SleeperTransaction,
  SleeperTradedPick,
  SleeperPlayoffMatchup,
  SleeperDraft,
  SleeperDraftPick,
} from "../../services/sleeperService.js";

function toLeague(s: SleeperLeague): League {
  return {
    ref: { provider: "sleeper", leagueId: s.league_id },
    name: s.name,
    season: s.season,
    status: s.status,
    totalRosters: s.total_rosters,
    sport: s.sport,
    avatar: s.avatar ?? null,
    previousLeagueRef:
      s.previous_league_id && s.previous_league_id !== "0"
        ? { provider: "sleeper", leagueId: s.previous_league_id }
        : null,
    settings: (s.settings as Record<string, unknown>) ?? {},
  };
}

function toRoster(s: SleeperRoster): Roster {
  return {
    rosterId: s.roster_id,
    ownerId: s.owner_id,
    leagueId: s.league_id,
    players: s.players ?? [],
    starters: s.starters ?? [],
    reserve: s.reserve ?? [],
    record: {
      wins: s.settings?.wins ?? 0,
      losses: s.settings?.losses ?? 0,
      ties: s.settings?.ties ?? 0,
    },
    pointsFor: (s.settings?.fpts ?? 0) + (s.settings?.fpts_decimal ?? 0) / 100,
    pointsAgainst:
      (s.settings?.fpts_against ?? 0) +
      (s.settings?.fpts_against_decimal ?? 0) / 100,
  };
}

function toTeamUser(s: SleeperLeagueUser): TeamUser {
  return {
    userId: s.user_id,
    username: s.username,
    displayName: s.display_name,
    avatar: s.avatar,
    teamName: s.metadata?.team_name ?? null,
    isOwner: s.is_owner ?? false,
  };
}

function toMatchup(s: SleeperMatchup): Matchup {
  return {
    rosterId: s.roster_id,
    matchupId: s.matchup_id,
    points: s.points,
    starters: s.starters,
    players: s.players,
  };
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
  };
}

function toNFLState(s: SleeperNFLState): NFLState {
  return {
    week: s.week,
    season: s.season,
    season_type: s.season_type,
    league_create_season: s.league_create_season,
    display_week: s.display_week,
    season_start_date: s.season_start_date,
  };
}

function toTradedPick(s: SleeperTradedPick): TradedPick {
  return {
    season: s.season,
    round: s.round,
    roster_id: s.roster_id,
    previous_owner_id: s.previous_owner_id,
    owner_id: s.owner_id,
  };
}

function toTransaction(s: SleeperTransaction): Transaction {
  return {
    transaction_id: s.transaction_id,
    type: s.type,
    status: s.status,
    roster_ids: s.roster_ids,
    adds: s.adds,
    drops: s.drops,
    draft_picks: s.draft_picks.map(toTradedPick),
    waiver_budget: s.waiver_budget,
    created: s.created,
    status_updated: s.status_updated,
    leg: s.leg,
    consenter_ids: s.consenter_ids,
  };
}

function toPlayoffMatchup(s: SleeperPlayoffMatchup): PlayoffMatchup {
  return {
    round: s.r,
    matchup_id: s.m,
    team1_roster_id: s.t1,
    team2_roster_id: s.t2,
    winner_roster_id: s.w,
    loser_roster_id: s.l,
    place: s.p ?? null,
    team1_from: s.t1_from
      ? { winner_of: s.t1_from.w, loser_of: s.t1_from.l }
      : null,
    team2_from: s.t2_from
      ? { winner_of: s.t2_from.w, loser_of: s.t2_from.l }
      : null,
  };
}

function toDraft(s: SleeperDraft): Draft {
  const settings = s.settings as Record<string, unknown>;
  return {
    draft_id: s.draft_id,
    league_id: s.league_id,
    season: s.season,
    status: s.status,
    type: s.type,
    sport: s.sport,
    settings: {
      teams: Number(settings["teams"] ?? 0),
      rounds: Number(settings["rounds"] ?? 0),
      pick_timer: Number(settings["pick_timer"] ?? 0),
      cpu_autopick: Boolean(settings["cpu_autopick"]),
      reversal_round: Number(settings["reversal_round"] ?? 0),
      player_type: Number(settings["player_type"] ?? 0),
      budget: Number(settings["budget"] ?? 0),
      nominate_count: Number(settings["nominate_count"] ?? 0),
      reserve_rounds: Number(settings["reserve_rounds"] ?? 0),
      slots_wr: Number(settings["slots_wr"] ?? 0),
      slots_rb: Number(settings["slots_rb"] ?? 0),
      slots_qb: Number(settings["slots_qb"] ?? 0),
      slots_te: Number(settings["slots_te"] ?? 0),
      slots_flex: Number(settings["slots_flex"] ?? 0),
      slots_def: Number(settings["slots_def"] ?? 0),
      slots_k: Number(settings["slots_k"] ?? 0),
      slots_bn: Number(settings["slots_bn"] ?? 0),
    },
    slot_to_roster_id: s.slot_to_roster_id,
    draft_order: s.draft_order,
    created: s.created,
    updated: s.updated,
    start_time: s.start_time,
    last_picked: s.last_picked,
  };
}

function toDraftPick(s: SleeperDraftPick): DraftPick {
  return {
    round: s.round,
    roster_id: s.roster_id,
    player_id: s.player_id,
    picked_by: s.picked_by,
    pick_no: s.pick_no,
    metadata: {
      team: s.metadata["team"] ?? "",
      status: s.metadata["status"] ?? "",
      sport: s.metadata["sport"] ?? "",
      position: s.metadata["position"] ?? "",
      player_id: s.metadata["player_id"] ?? "",
      number: s.metadata["number"] ?? "",
      news_updated: s.metadata["news_updated"] ?? "",
      last_name: s.metadata["last_name"] ?? "",
      injury_status: s.metadata["injury_status"] ?? "",
      first_name: s.metadata["first_name"] ?? "",
    },
    is_keeper: s.is_keeper,
    draft_id: s.draft_id,
  };
}

export const sleeperProvider: FantasyProvider = {
  id: "sleeper",

  async getAccount(username: string): Promise<ConnectedAccount | null> {
    const user = await getSleeperUser(username);
    if (!user) return null;
    return {
      provider: "sleeper",
      username: user.username,
      userId: user.user_id,
    };
  },

  async getUserLeagues(userId: string, year: string): Promise<League[]> {
    const leagues = await getSleeperLeagues(userId, year);
    return leagues.map(toLeague);
  },

  async getAllUserLeagues(userId: string): Promise<League[]> {
    const currentYear = new Date().getFullYear();
    const START_YEAR = 2017; // Sleeper launched in 2017
    const years = Array.from({ length: currentYear - START_YEAR + 1 }, (_, i) =>
      (START_YEAR + i).toString(),
    );
    const results = await Promise.allSettled(
      years.map((y) => getSleeperLeagues(userId, y)),
    );
    const seen = new Set<string>();
    return results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .filter((l) => {
        if (seen.has(l.league_id)) return false;
        seen.add(l.league_id);
        return true;
      })
      .sort(
        (a, b) =>
          Number(b.season) - Number(a.season) || a.name.localeCompare(b.name),
      )
      .map(toLeague);
  },

  async getLeagueHistory(leagueId: string): Promise<League[]> {
    const history: League[] = [];
    let currentId: string | null = leagueId;
    const MAX_DEPTH = 15;
    let iterations = 0;
    while (currentId && iterations < MAX_DEPTH) {
      const s = await getLeague(currentId);
      const league = toLeague(s);
      history.push(league);
      currentId = league.previousLeagueRef?.leagueId ?? null;
      iterations++;
    }
    return history;
  },

  async getLeague(leagueId: string): Promise<League> {
    return toLeague(await getLeague(leagueId));
  },

  async getRosters(leagueId: string): Promise<Roster[]> {
    return (await getLeagueRosters(leagueId)).map(toRoster);
  },

  async getLeagueUsers(leagueId: string): Promise<TeamUser[]> {
    return (await getLeagueUsers(leagueId)).map(toTeamUser);
  },

  async getMatchups(leagueId: string, week: number): Promise<Matchup[]> {
    return (await getLeagueMatchups(leagueId, week)).map(toMatchup);
  },

  async getPlayers(): Promise<Record<string, Player>> {
    const raw = await getNFLPlayers();
    const result: Record<string, Player> = {};
    for (const [id, p] of Object.entries(raw)) {
      result[id] = toPlayer(id, p);
    }
    return result;
  },

  async getNFLState(): Promise<NFLState> {
    return toNFLState(await getNFLState());
  },

  async getTransactions(
    leagueId: string,
    week: number,
  ): Promise<Transaction[]> {
    return (await getLeagueTransactions(leagueId, week)).map(toTransaction);
  },

  async getTradedPicks(leagueId: string): Promise<TradedPick[]> {
    return (await getTradedPicks(leagueId)).map(toTradedPick);
  },

  async getWinnersBracket(leagueId: string): Promise<PlayoffMatchup[]> {
    return (await getWinnersBracket(leagueId)).map(toPlayoffMatchup);
  },

  async getLosersBracket(leagueId: string): Promise<PlayoffMatchup[]> {
    return (await getLosersBracket(leagueId)).map(toPlayoffMatchup);
  },

  async getDraft(draftId: string): Promise<Draft> {
    return toDraft(await getDraft(draftId));
  },

  async getDraftPicks(draftId: string): Promise<DraftPick[]> {
    return (await getDraftPicks(draftId)).map(toDraftPick);
  },
};
