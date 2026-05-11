const SLEEPER_BASE = "https://api.sleeper.app/v1";

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name?: string;
  avatar?: string | null;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  total_rosters: number;
  sport: string;
  avatar?: string | null;
  previous_league_id?: string | null;
  scoring_settings?: Record<string, number>;
  roster_positions?: string[];
  settings?: Record<string, unknown>;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  league_id: string;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  settings?: {
    wins?: number;
    losses?: number;
    ties?: number;
    fpts?: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
    waiver_position?: number;
    waiver_budget_used?: number;
    total_moves?: number;
  };
  // Sleeper stores the current W/L streak here as a short string ("3W" /
  // "2L"). Optional because Sleeper omits it for pre-draft / drafting
  // leagues, and historical leagues may not always carry it.
  metadata?: {
    streak?: string;
  };
}

export interface SleeperLeagueUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
  metadata?: { team_name?: string };
  is_owner?: boolean;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number | null;
  points: number;
  custom_points: number | null;
  starters: string[];
  players: string[];
  /** Per-player fantasy points for this roster this week, keyed by player_id */
  players_points: Record<string, number> | null;
}

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  position: string;
  fantasy_positions?: string[];
  team: string | null;
  status: string;
  age?: number;
  number?: number;
  depth_chart_position?: number;
  injury_status?: string | null;
  avatar?: string | null;
}

// In-memory player cache — shared across all users, 24hr TTL
let playerCache: Record<string, SleeperPlayer> | null = null;
let playerCacheExpiry = 0;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 404)
    throw Object.assign(new Error("Not found"), { status: 404 });
  if (!res.ok)
    throw Object.assign(new Error(`Sleeper API error: ${res.status}`), {
      status: res.status,
    });
  return res.json() as Promise<T>;
}

export async function getSleeperUser(
  username: string,
): Promise<SleeperUser | null> {
  try {
    const data = await fetchJson<SleeperUser>(
      `${SLEEPER_BASE}/user/${encodeURIComponent(username)}`,
    );
    return data ?? null;
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function getSleeperLeagues(
  userId: string,
  year: string,
): Promise<SleeperLeague[]> {
  try {
    const data = await fetchJson<SleeperLeague[]>(
      `${SLEEPER_BASE}/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(year)}`,
    );
    return data ?? [];
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return [];
    throw err;
  }
}

export async function getLeague(leagueId: string): Promise<SleeperLeague> {
  return fetchJson<SleeperLeague>(
    `${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}`,
  );
}

export async function getLeagueRosters(
  leagueId: string,
): Promise<SleeperRoster[]> {
  return fetchJson<SleeperRoster[]>(
    `${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}/rosters`,
  );
}

export async function getLeagueUsers(
  leagueId: string,
): Promise<SleeperLeagueUser[]> {
  return fetchJson<SleeperLeagueUser[]>(
    `${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}/users`,
  );
}

export async function getLeagueMatchups(
  leagueId: string,
  week: number,
): Promise<SleeperMatchup[]> {
  return fetchJson<SleeperMatchup[]>(
    `${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}/matchups/${week}`,
  );
}

export async function getNFLPlayers(): Promise<Record<string, SleeperPlayer>> {
  const now = Date.now();
  if (playerCache && now < playerCacheExpiry) {
    return playerCache;
  }
  const data = await fetchJson<Record<string, SleeperPlayer>>(
    `${SLEEPER_BASE}/players/nfl`,
  );
  playerCache = data;
  playerCacheExpiry = now + 24 * 60 * 60 * 1000; // 24hr
  return data;
}

export interface SleeperNFLState {
  week: number;
  season: string;
  season_type: "pre" | "regular" | "post";
  league_create_season: string;
  display_week: number;
  season_start_date: string;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: "waiver" | "free_agent" | "trade";
  status: "complete" | "failed" | "pending";
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: SleeperTradedPick[];
  waiver_budget: Array<{ sender: number; receiver: number; amount: number }>;
  created: number;
  status_updated: number;
  leg: number;
  consenter_ids: number[];
}

export interface SleeperTradedPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

export interface SleeperPlayoffMatchup {
  r: number; // round
  m: number; // matchup_id
  t1: number | null;
  t2: number | null;
  w: number | null;
  l: number | null;
  p?: number; // place (consolation)
  t1_from?: { w?: number; l?: number };
  t2_from?: { w?: number; l?: number };
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  season: string;
  status: "pre_draft" | "drafting" | "complete" | "paused";
  type: "snake" | "auction" | "linear";
  sport: string;
  settings: Record<string, unknown>;
  slot_to_roster_id: Record<string, number>;
  draft_order: Record<string, number> | null;
  created: number;
  updated: number;
  start_time: number;
  last_picked: number;
}

export interface SleeperDraftPick {
  round: number;
  roster_id: number;
  player_id: string;
  picked_by: string;
  pick_no: number;
  metadata: Record<string, string>;
  is_keeper: boolean | null;
  draft_id: string;
}

// NFL State cache — changes at most once per week
let nflStateCache: SleeperNFLState | null = null;
let nflStateCacheExpiry = 0;

export async function getNFLState(): Promise<SleeperNFLState> {
  const now = Date.now();
  if (nflStateCache && now < nflStateCacheExpiry) return nflStateCache;
  const data = await fetchJson<SleeperNFLState>(`${SLEEPER_BASE}/state/nfl`);
  nflStateCache = data;
  nflStateCacheExpiry = now + 60 * 60 * 1000; // 1hr TTL
  return data;
}

export async function getLeagueTransactions(
  leagueId: string,
  week: number,
): Promise<SleeperTransaction[]> {
  try {
    const data = await fetchJson<SleeperTransaction[]>(
      `${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}/transactions/${week}`,
    );
    return data ?? [];
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return [];
    throw err;
  }
}

export async function getTradedPicks(
  leagueId: string,
): Promise<SleeperTradedPick[]> {
  try {
    const data = await fetchJson<SleeperTradedPick[]>(
      `${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}/traded_picks`,
    );
    return data ?? [];
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return [];
    throw err;
  }
}

export async function getWinnersBracket(
  leagueId: string,
): Promise<SleeperPlayoffMatchup[]> {
  try {
    const data = await fetchJson<SleeperPlayoffMatchup[]>(
      `${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}/winners_bracket`,
    );
    return data ?? [];
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return [];
    throw err;
  }
}

export async function getLosersBracket(
  leagueId: string,
): Promise<SleeperPlayoffMatchup[]> {
  try {
    const data = await fetchJson<SleeperPlayoffMatchup[]>(
      `${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}/losers_bracket`,
    );
    return data ?? [];
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return [];
    throw err;
  }
}

export async function getDraft(draftId: string): Promise<SleeperDraft> {
  return fetchJson<SleeperDraft>(
    `${SLEEPER_BASE}/draft/${encodeURIComponent(draftId)}`,
  );
}

export async function getDraftPicks(
  draftId: string,
): Promise<SleeperDraftPick[]> {
  try {
    const data = await fetchJson<SleeperDraftPick[]>(
      `${SLEEPER_BASE}/draft/${encodeURIComponent(draftId)}/picks`,
    );
    return data ?? [];
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return [];
    throw err;
  }
}

// ---- Player stats (fantasy points by player ID for a given week) ----

/**
 * Raw Sleeper stats object — keys are stat identifiers (pts_ppr, rush_yd, etc.)
 * plus a synthetic `pts_*` key the server adds based on league scoring.
 * The `pts_ppr` / `pts_std` / `pts_half_ppr` keys hold the pre-computed
 * fantasy total for standard scoring types; we use `pts_ppr` as the default.
 */
export interface SleeperPlayerStats {
  player_id: string;
  [stat: string]: number | string;
}

/** Keyed by player_id */
export type SleeperStatsMap = Record<string, SleeperPlayerStats>;

/**
 * Fetch per-player fantasy stats for a given NFL season + week.
 * Sleeper returns an empty object for future weeks.
 * Season type is always "regular" for our use case.
 */
export async function getPlayerStats(
  season: string,
  week: number,
): Promise<SleeperStatsMap> {
  return fetchJson<SleeperStatsMap>(
    `${SLEEPER_BASE}/stats/nfl/regular/${season}/${week}`,
  );
}
