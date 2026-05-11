/**
 * Sleeper data hooks.
 *
 * Every hook in this file is a thin TanStack Query wrapper around our own
 * Express backend, NOT the Sleeper API directly. The server proxies + maps
 * raw Sleeper shapes into the normalized domain types defined in
 * `types/fantasy.ts`, so client code never has to think about provider
 * specifics. Adding a new fantasy provider (ESPN, Yahoo) would mean
 * implementing the same endpoints on the server — the client would not
 * change.
 *
 * Endpoint convention: `/api/provider/sleeper/...` is hit by every query
 * below via the `base()` helper. The server file is
 * `server/src/routes/providerRoutes.ts`.
 *
 * Stale-time conventions (rough heuristics):
 *   - 24h  — global, slow-moving data (NFL player dictionary)
 *   - 1h   — global, sometimes-updated data (NFL state, draft picks)
 *   - 10m  — fast-moving game data (player stats during live scoring)
 *   - 5m   — most league-scoped data (rosters, users, league detail)
 *   - 2m   — live matchups (scores while games are happening)
 *
 * Every hook keys its query by `leagueId` (and where relevant `week` / etc.)
 * so swapping leagues triggers a refetch automatically. Hooks that take a
 * nullable `leagueId` use `enabled: !!leagueId` to skip the fetch entirely
 * until a selection exists — important because Dashboard pages render
 * before Redux has hydrated.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setSyncedLeagueIds } from "../store/slices/authSlice";
import type {
  League,
  Roster,
  TeamUser,
  Matchup,
  Player,
  NFLState,
  Transaction,
  TradedPick,
  PlayoffMatchup,
  Draft,
  DraftPick,
} from "../types/fantasy";

const PROVIDER = "sleeper";
/** Build a backend URL for the configured provider. Hides the prefix from callers. */
const base = (path: string) => `/api/provider/${PROVIDER}${path}`;

// ---- Leagues (current year) ----
//
// Returns the user's Sleeper leagues for the year currently selected in
// Redux. Used by /leagues to populate the "sync" UI. For dashboard-style
// "what leagues does the user have across all seasons", see
// `useAllSleeperLeagues` below.

export function useSleeperLeagues() {
  const sleeperUserId = useAppSelector(
    (state) => state.auth.user?.sleeperUserId,
  );
  const year = useAppSelector((state) => state.auth.selectedYear);

  return useQuery({
    queryKey: ["sleeper-leagues", sleeperUserId, year],
    queryFn: async () => {
      const res = await axios.get<{ leagues: League[] }>(
        base(`/user/${sleeperUserId}/leagues/${year}`),
      );
      return res.data.leagues;
    },
    enabled: !!sleeperUserId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---- All leagues across all seasons ----
//
// Returns *every* league this Sleeper user has been in (any year). The
// dashboard and AppShell rely on this to build league families — sibling
// seasons of the same recurring league chained via `previousLeagueRef`.
// Held longer (10m) since the historical entries rarely change.

export function useAllSleeperLeagues() {
  const sleeperUserId = useAppSelector(
    (state) => state.auth.user?.sleeperUserId,
  );

  return useQuery({
    queryKey: ["sleeper-leagues-all", sleeperUserId],
    queryFn: async () => {
      const res = await axios.get<{ leagues: League[] }>(
        base(`/user/${sleeperUserId}/leagues`),
      );
      return res.data.leagues;
    },
    enabled: !!sleeperUserId,
    staleTime: 10 * 60 * 1000,
  });
}

// ---- League detail ----

export function useLeague(leagueId: string | null) {
  return useQuery({
    queryKey: ["sleeper-league", leagueId],
    queryFn: async () => {
      const res = await axios.get<{ league: League }>(
        base(`/league/${leagueId}`),
      );
      return res.data.league;
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---- Rosters ----

export function useLeagueRosters(leagueId: string | null) {
  return useQuery({
    queryKey: ["sleeper-rosters", leagueId],
    queryFn: async () => {
      const res = await axios.get<{ rosters: Roster[] }>(
        base(`/league/${leagueId}/rosters`),
      );
      return res.data.rosters;
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---- League users ----

export function useLeagueUsers(leagueId: string | null) {
  return useQuery({
    queryKey: ["sleeper-league-users", leagueId],
    queryFn: async () => {
      const res = await axios.get<{ users: TeamUser[] }>(
        base(`/league/${leagueId}/users`),
      );
      return res.data.users;
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---- Matchups ----
//
// One scoring week's matchups for a league. Sleeper returns these as a
// flat list of per-roster entries — teams in the same head-to-head game
// share a `matchupId`. Callers (Scoreboard, Ticker, MyTeamSection)
// typically bucket by `matchupId` to recover pairs.
//
// Pass `week = 0` to disable the fetch entirely — used by callers like
// MyTeamSection when there's no meaningful "next week" (past-season
// leagues). 2-minute stale time so live scores feel responsive without
// hammering the proxy.

export function useLeagueMatchups(leagueId: string | null, week: number) {
  return useQuery({
    queryKey: ["sleeper-matchups", leagueId, week],
    queryFn: async () => {
      const res = await axios.get<{ matchups: Matchup[] }>(
        base(`/league/${leagueId}/matchups/${week}`),
      );
      return res.data.matchups;
    },
    enabled: !!leagueId && week >= 1,
    staleTime: 2 * 60 * 1000,
  });
}

// ---- Players ----
//
// The full NFL player dictionary, keyed by player_id. ~5MB on the wire, so
// we cache aggressively (24h staleTime + gcTime). Sleeper's "/players/nfl"
// endpoint is the authoritative source of names, positions, and team
// affiliations. Used wherever we need to translate a roster's player_id
// list into something human-readable.

export function useNFLPlayers() {
  return useQuery({
    queryKey: ["nfl-players"],
    queryFn: async () => {
      const res = await axios.get<{ players: Record<string, Player> }>(
        base("/players"),
      );
      return res.data.players;
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

// ---- NFL State (current week/season) ----
//
// What Sleeper considers "today" — the live NFL season + week + season
// type ("pre" / "regular" / "post"). DashboardPage uses this to decide
// whether the selected league is the active current-season league and
// pick a sensible default display week. 1h staleTime is fine — the
// NFL state only ticks forward weekly during the season.
export function useNFLState() {
  return useQuery({
    queryKey: ["provider-state", PROVIDER],
    queryFn: async () => {
      const res = await axios.get<{ state: NFLState }>(base("/state"));
      return res.data.state;
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

// ---- Player stats ----

/**
 * Per-player fantasy stats for a specific season + week.
 * Returns a map of playerId -> { pts_ppr, pts_std, rush_yd, rec_td, ... }.
 * Stale after 10 minutes during the active scoring window; 24h otherwise.
 */
export function usePlayerStats(season: string | null, week: number | null) {
  return useQuery({
    queryKey: ["player-stats", PROVIDER, season, week],
    queryFn: async () => {
      const res = await axios.get<{
        stats: import("../types/fantasy").PlayerStatsMap;
      }>(base(`/stats/${season}/${week}`));
      return res.data.stats;
    },
    enabled: !!season && !!week && week > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

// ---- Transactions ----
export function useLeagueTransactions(
  leagueId: string | null,
  week: number | null,
) {
  return useQuery({
    queryKey: ["provider-transactions", PROVIDER, leagueId, week],
    queryFn: async () => {
      const res = await axios.get<{ transactions: Transaction[] }>(
        base(`/league/${leagueId}/transactions/${week}`),
      );
      return res.data.transactions;
    },
    enabled: !!leagueId && !!week && week >= 1,
    staleTime: 5 * 60 * 1000,
  });
}

// ---- Traded Picks ----
export function useTradedPicks(leagueId: string | null) {
  return useQuery({
    queryKey: ["provider-traded-picks", PROVIDER, leagueId],
    queryFn: async () => {
      const res = await axios.get<{ picks: TradedPick[] }>(
        base(`/league/${leagueId}/traded_picks`),
      );
      return res.data.picks;
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---- Winners Bracket ----
//
// The post-season bracket for places 1 through ~6. Scoreboard uses this to
// label playoff matchups (Championship / 3rd Place / Playoff). Each entry
// has `team1_from` / `team2_from` pointers describing which earlier-round
// matchup fed each slot (e.g. `winner_of: 5`), which is how we identify
// the championship game versus the 3rd-place consolation in the final
// round.
export function useWinnersBracket(leagueId: string | null) {
  return useQuery({
    queryKey: ["provider-winners-bracket", PROVIDER, leagueId],
    queryFn: async () => {
      const res = await axios.get<{ bracket: PlayoffMatchup[] }>(
        base(`/league/${leagueId}/winners_bracket`),
      );
      return res.data.bracket;
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---- Losers Bracket ----
//
// The post-season consolation/toilet bowl bracket (places ~7-12). Same
// shape as the winners bracket; Scoreboard uses it to fill in the
// non-championship playoff weeks so every matchup gets a proper badge.
export function useLosersBracket(leagueId: string | null) {
  return useQuery({
    queryKey: ["provider-losers-bracket", PROVIDER, leagueId],
    queryFn: async () => {
      const res = await axios.get<{ bracket: PlayoffMatchup[] }>(
        base(`/league/${leagueId}/losers_bracket`),
      );
      return res.data.bracket;
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---- Draft ----
export function useDraft(draftId: string | null) {
  return useQuery({
    queryKey: ["provider-draft", PROVIDER, draftId],
    queryFn: async () => {
      const res = await axios.get<{ draft: Draft }>(base(`/draft/${draftId}`));
      return res.data.draft;
    },
    enabled: !!draftId,
    staleTime: 60 * 60 * 1000,
  });
}

// ---- Draft Picks ----
export function useDraftPicks(draftId: string | null) {
  return useQuery({
    queryKey: ["provider-draft-picks", PROVIDER, draftId],
    queryFn: async () => {
      const res = await axios.get<{ picks: DraftPick[] }>(
        base(`/draft/${draftId}/picks`),
      );
      return res.data.picks;
    },
    enabled: !!draftId,
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Mutation: persist the user's selected synced league IDs to the backend.
 *
 * Used by the /leagues page when the user toggles which Sleeper leagues
 * they want to track. On success we both:
 *   - update the Redux `auth.user.syncedLeagueIds` so the rest of the app
 *     (sidebar, dashboard) sees the new selection immediately
 *   - invalidate the cached `sleeper-leagues` queries so any league lists
 *     downstream refetch
 *
 * Clerk JWT is forwarded via Bearer header — the backend uses it to
 * identify the user and write to the right row in Postgres.
 */
export function useSyncLeagues() {
  const { getToken } = useAuth();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (syncedLeagueIds: string[]) => {
      const token = await getToken();
      const res = await axios.patch<{ syncedLeagueIds: string[] }>(
        "/api/user/synced-leagues",
        { syncedLeagueIds },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return res.data.syncedLeagueIds;
    },
    onSuccess: (syncedLeagueIds) => {
      dispatch(setSyncedLeagueIds(syncedLeagueIds));
      queryClient.invalidateQueries({ queryKey: ["sleeper-leagues"] });
    },
  });
}
