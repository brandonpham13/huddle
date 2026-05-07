import express, { type Express, type Request, type Response } from "express";
import { getProvider } from "../providers/registry.js";
import type { FantasyProvider } from "../providers/types.js";
import { computePowerRankings } from "../services/powerRankingsService.js";
import "../algorithms/index.js";

/**
 * Resolves a provider by ID from the URL param, or responds 404 and returns null.
 * Adding a new platform = implement FantasyProvider + register it in providers/registry.ts.
 */
function resolveProvider(
  providerId: string,
  res: Response,
): FantasyProvider | null {
  const provider = getProvider(providerId);
  if (!provider) {
    res.status(404).json({ error: `Unknown provider: ${providerId}` });
    return null;
  }
  return provider;
}

function httpStatus(err: unknown): number {
  return (err as { status?: number }).status === 404 ? 404 : 502;
}

export function initProviderRoutes(app: Express) {
  const router = express.Router();

  // GET /api/provider/:providerId/user/:username
  router.get(
    "/:providerId/user/:username",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      const { username } = req.params;
      if (!username?.trim()) {
        res.status(400).json({ error: "username is required" });
        return;
      }
      try {
        const account = await provider.getAccount(username);
        if (!account) {
          res.status(404).json({ error: "User not found" });
          return;
        }
        res.json({ account });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/user/:userId/leagues
  // Returns all leagues the user has ever been in, across all seasons.
  router.get(
    "/:providerId/user/:userId/leagues",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      const { userId } = req.params;
      if (!userId?.trim()) {
        res.status(400).json({ error: "userId is required" });
        return;
      }
      try {
        const leagues = await provider.getAllUserLeagues(userId);
        res.json({ leagues });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/user/:userId/leagues/:year
  router.get(
    "/:providerId/user/:userId/leagues/:year",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      const { userId, year } = req.params;
      if (!userId?.trim()) {
        res.status(400).json({ error: "userId is required" });
        return;
      }
      try {
        const leagues = await provider.getUserLeagues(userId, year);
        res.json({ leagues });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/league/:leagueId/history
  // Must be registered before /:leagueId to avoid "history" matching the leagueId param.
  router.get(
    "/:providerId/league/:leagueId/history",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      try {
        const history = await provider.getLeagueHistory(req.params.leagueId);
        // Return only the ref + season — the route layer doesn't expose full League objects here
        res.json({
          history: history.map((l) => ({
            leagueId: l.ref.leagueId,
            season: l.season,
          })),
        });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/league/:leagueId/rosters
  router.get(
    "/:providerId/league/:leagueId/rosters",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      try {
        const rosters = await provider.getRosters(req.params.leagueId);
        res.json({ rosters });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/league/:leagueId/users
  router.get(
    "/:providerId/league/:leagueId/users",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      try {
        const users = await provider.getLeagueUsers(req.params.leagueId);
        res.json({ users });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/league/:leagueId/matchups/:week
  router.get(
    "/:providerId/league/:leagueId/matchups/:week",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      const week = parseInt(req.params.week, 10);
      if (isNaN(week) || week < 1 || week > 18) {
        res.status(400).json({ error: "week must be between 1 and 18" });
        return;
      }
      try {
        const matchups = await provider.getMatchups(req.params.leagueId, week);
        res.json({ matchups });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/league/:leagueId/transactions/:week
  router.get(
    "/:providerId/league/:leagueId/transactions/:week",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      if (!provider.getTransactions) {
        res
          .status(404)
          .json({
            error: `${req.params.providerId} does not support transactions`,
          });
        return;
      }
      const week = parseInt(req.params.week, 10);
      if (isNaN(week) || week < 1 || week > 18) {
        res.status(400).json({ error: "week must be between 1 and 18" });
        return;
      }
      try {
        const transactions = await provider.getTransactions(
          req.params.leagueId,
          week,
        );
        res.json({ transactions });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/league/:leagueId/traded_picks
  router.get(
    "/:providerId/league/:leagueId/traded_picks",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      if (!provider.getTradedPicks) {
        res
          .status(404)
          .json({
            error: `${req.params.providerId} does not support traded picks`,
          });
        return;
      }
      try {
        const picks = await provider.getTradedPicks(req.params.leagueId);
        res.json({ picks });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/league/:leagueId/winners_bracket
  router.get(
    "/:providerId/league/:leagueId/winners_bracket",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      if (!provider.getWinnersBracket) {
        res
          .status(404)
          .json({
            error: `${req.params.providerId} does not support playoff brackets`,
          });
        return;
      }
      try {
        const bracket = await provider.getWinnersBracket(req.params.leagueId);
        res.json({ bracket });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/league/:leagueId/losers_bracket
  router.get(
    "/:providerId/league/:leagueId/losers_bracket",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      if (!provider.getLosersBracket) {
        res
          .status(404)
          .json({
            error: `${req.params.providerId} does not support consolation brackets`,
          });
        return;
      }
      try {
        const bracket = await provider.getLosersBracket(req.params.leagueId);
        res.json({ bracket });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/league/:leagueId
  router.get(
    "/:providerId/league/:leagueId",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      try {
        const league = await provider.getLeague(req.params.leagueId);
        res.json({ league });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/players
  router.get("/:providerId/players", async (req: Request, res: Response) => {
    const provider = resolveProvider(req.params.providerId, res);
    if (!provider) return;
    if (!provider.getPlayers) {
      res
        .status(404)
        .json({
          error: `${req.params.providerId} does not expose a player dictionary`,
        });
      return;
    }
    try {
      const players = await provider.getPlayers();
      res.json({ players });
    } catch (err) {
      res
        .status(httpStatus(err))
        .json({ error: err instanceof Error ? err.message : "Unknown" });
    }
  });

  // GET /api/provider/:providerId/state
  router.get("/:providerId/state", async (req: Request, res: Response) => {
    const provider = resolveProvider(req.params.providerId, res);
    if (!provider) return;
    if (!provider.getNFLState) {
      res
        .status(404)
        .json({ error: `${req.params.providerId} does not expose NFL state` });
      return;
    }
    try {
      const state = await provider.getNFLState();
      res.json({ state });
    } catch (err) {
      res
        .status(httpStatus(err))
        .json({ error: err instanceof Error ? err.message : "Unknown" });
    }
  });

  // GET /api/provider/:providerId/draft/:draftId/picks
  router.get(
    "/:providerId/draft/:draftId/picks",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      if (!provider.getDraftPicks) {
        res
          .status(404)
          .json({
            error: `${req.params.providerId} does not support draft picks`,
          });
        return;
      }
      try {
        const picks = await provider.getDraftPicks(req.params.draftId);
        res.json({ picks });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/draft/:draftId
  router.get(
    "/:providerId/draft/:draftId",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      if (!provider.getDraft) {
        res
          .status(404)
          .json({
            error: `${req.params.providerId} does not support draft data`,
          });
        return;
      }
      try {
        const draft = await provider.getDraft(req.params.draftId);
        res.json({ draft });
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  // GET /api/provider/:providerId/league/:leagueId/power-rankings
  // Returns power rankings for all registered algorithms.
  // Optional query param: ?week=N to override the current week used for matchup data.
  router.get(
    "/:providerId/league/:leagueId/power-rankings",
    async (req: Request, res: Response) => {
      const provider = resolveProvider(req.params.providerId, res);
      if (!provider) return;
      const { leagueId } = req.params;

      try {
        // Fetch base data in parallel
        const [rosters, users, nflState] = await Promise.all([
          provider.getRosters(leagueId),
          provider.getLeagueUsers(leagueId),
          provider.getNFLState?.(),
        ]);

        const currentWeek = req.query.week
          ? parseInt(req.query.week as string, 10)
          : (nflState?.week ?? 1);

        // Fetch all completed weeks of matchups in parallel
        const weekNumbers = Array.from(
          { length: currentWeek },
          (_, i) => i + 1,
        );
        const matchupsByWeek = await Promise.all(
          weekNumbers.map((week) => provider.getMatchups(leagueId, week)),
        );

        const result = computePowerRankings({
          rosters,
          matchupsByWeek,
          users,
          currentWeek,
        });

        res.json(result);
      } catch (err) {
        res
          .status(httpStatus(err))
          .json({ error: err instanceof Error ? err.message : "Unknown" });
      }
    },
  );

  app.use("/api/provider", router);
}
