import { type Express, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../middleware/requireAuth.js";
import { HuddlesServiceError } from "../services/huddlesService.js";
import { getDashboardPoll, setDashboardPoll, castVote } from "../services/pollService.js";

function handleError(err: unknown, res: Response): void {
  if (err instanceof HuddlesServiceError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error("pollRoutes error:", err);
  res.status(500).json({ error: "Internal error" });
}

export function initPollRoutes(app: Express) {
  // GET /api/huddles/:id/dashboard-poll — any authenticated member
  app.get(
    "/api/huddles/:id/dashboard-poll",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const poll = await getDashboardPoll(req.params.id!, userId!);
        res.json({ poll });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // PUT /api/huddles/:id/dashboard-poll — commissioner only
  app.put(
    "/api/huddles/:id/dashboard-poll",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { question, options, allowMultiple, allowVoteChanges, resultsVisibility } =
          req.body as Record<string, unknown>;

        if (typeof question !== "string") {
          res.status(400).json({ error: "question (string) required" });
          return;
        }
        if (!Array.isArray(options) || !options.every((o) => typeof o === "string")) {
          res.status(400).json({ error: "options (string[]) required" });
          return;
        }

        const poll = await setDashboardPoll(req.params.id!, userId!, {
          question,
          options,
          allowMultiple: allowMultiple === true,
          allowVoteChanges: allowVoteChanges !== false,
          resultsVisibility: resultsVisibility === "after_vote" ? "after_vote" : "always",
        });
        res.json({ poll });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // POST /api/huddles/:id/dashboard-poll/vote — approved members only
  app.post(
    "/api/huddles/:id/dashboard-poll/vote",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { pollId, optionIds } = req.body as { pollId?: unknown; optionIds?: unknown };
        if (typeof pollId !== "string") {
          res.status(400).json({ error: "pollId (string) required" });
          return;
        }
        if (!Array.isArray(optionIds) || !optionIds.every((id) => typeof id === "string")) {
          res.status(400).json({ error: "optionIds (string[]) required" });
          return;
        }
        const poll = await castVote({ huddleId: req.params.id!, pollId, userId: userId!, optionIds });
        res.json({ poll });
      } catch (err) {
        handleError(err, res);
      }
    },
  );
}
