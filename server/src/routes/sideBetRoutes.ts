import { type Express, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../middleware/requireAuth.js";
import { HuddlesServiceError } from "../services/huddlesService.js";
import {
  listBets,
  proposeBet,
  respondToBet,
  cancelBet,
  settleBet,
} from "../services/sideBetsService.js";

function handleError(err: unknown, res: Response): void {
  if (err instanceof HuddlesServiceError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error("sideBetRoutes error:", err);
  res.status(500).json({ error: "Internal error" });
}

export function initSideBetRoutes(app: Express) {
  // GET /api/huddles/:id/bets?week=N
  app.get(
    "/api/huddles/:id/bets",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const weekParam = req.query["week"];
        const week =
          typeof weekParam === "string" && /^\d+$/.test(weekParam)
            ? Number(weekParam)
            : undefined;
        const bets = await listBets(req.params.id!, week);
        res.json({ bets });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // POST /api/huddles/:id/bets — propose a new bet
  app.post(
    "/api/huddles/:id/bets",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const {
          opponentId,
          proposerRosterId,
          opponentRosterId,
          week,
          season,
          description,
          amount,
        } = req.body as Record<string, unknown>;

        if (typeof opponentId !== "string" || !opponentId)
          return void res.status(400).json({ error: "opponentId required" });
        if (typeof week !== "number")
          return void res.status(400).json({ error: "week (number) required" });
        if (typeof season !== "string" || !season)
          return void res.status(400).json({ error: "season required" });
        if (typeof description !== "string" || !description.trim())
          return void res.status(400).json({ error: "description required" });
        if (typeof amount !== "number")
          return void res.status(400).json({ error: "amount (number, cents) required" });

        const bet = await proposeBet({
          huddleId: req.params.id!,
          proposerId: userId!,
          opponentId,
          proposerRosterId: typeof proposerRosterId === "number" ? proposerRosterId : undefined,
          opponentRosterId: typeof opponentRosterId === "number" ? opponentRosterId : undefined,
          week,
          season,
          description,
          amount,
        });
        res.status(201).json({ bet });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // PATCH /api/huddles/:id/bets/:betId — accept, reject, cancel, or settle
  app.patch(
    "/api/huddles/:id/bets/:betId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { action, winnerId, settlementNote } = req.body as Record<string, unknown>;

        if (action === "accepted" || action === "rejected") {
          const bet = await respondToBet({
            huddleId: req.params.id!,
            betId: req.params.betId!,
            userId: userId!,
            response: action,
          });
          return void res.json({ bet });
        }

        if (action === "cancelled") {
          const bet = await cancelBet({
            huddleId: req.params.id!,
            betId: req.params.betId!,
            userId: userId!,
          });
          return void res.json({ bet });
        }

        if (action === "settled") {
          if (typeof winnerId !== "string" || !winnerId)
            return void res.status(400).json({ error: "winnerId required for settlement" });
          const bet = await settleBet({
            huddleId: req.params.id!,
            betId: req.params.betId!,
            userId: userId!,
            winnerId,
            settlementNote: typeof settlementNote === "string" ? settlementNote : undefined,
          });
          return void res.json({ bet });
        }

        res.status(400).json({ error: "action must be accepted | rejected | cancelled | settled" });
      } catch (err) {
        handleError(err, res);
      }
    },
  );
}
