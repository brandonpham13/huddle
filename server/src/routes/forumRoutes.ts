import { type Express, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../middleware/requireAuth.js";
import { HuddlesServiceError } from "../services/huddlesService.js";
import {
  listTopics,
  getTopic,
  listReplies,
  createTopic,
  createReply,
  deleteTopic,
  deleteReply,
} from "../services/forumService.js";
import {
  getPollForTopic,
  getPollIdForTopic,
  castVote,
  type NewPollInput,
} from "../services/pollService.js";

function parsePollInput(body: Record<string, unknown>): NewPollInput | undefined {
  const { poll } = body as { poll?: unknown };
  if (poll === undefined || poll === null) return undefined;
  if (typeof poll !== "object") return undefined;

  const p = poll as Record<string, unknown>;
  const question = typeof p["question"] === "string" ? p["question"] : "";
  const options = Array.isArray(p["options"])
    ? p["options"].filter((o): o is string => typeof o === "string")
    : [];
  const allowMultiple = p["allowMultiple"] === true;
  const allowVoteChanges = p["allowVoteChanges"] !== false;
  const resultsVisibility = p["resultsVisibility"] === "after_vote" ? "after_vote" : "always";

  return { question, options, allowMultiple, allowVoteChanges, resultsVisibility };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof HuddlesServiceError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error("forumRoutes error:", err);
  res.status(500).json({ error: "Internal error" });
}

function parsePageParams(req: Request): { limit?: number; cursorParam: string | undefined } {
  const limitParam = req.query["limit"];
  const limit =
    typeof limitParam === "string" && /^\d+$/.test(limitParam) ? Number(limitParam) : undefined;
  const cursorParam = req.query["before"] ?? req.query["after"];
  return { limit, cursorParam: typeof cursorParam === "string" ? cursorParam : undefined };
}

export function initForumRoutes(app: Express) {
  // GET /api/huddles/:id/forum/topics?limit=&before= — any authenticated member
  app.get(
    "/api/huddles/:id/forum/topics",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { limit, cursorParam } = parsePageParams(req);
        const topics = await listTopics(req.params.id!, { limit, before: cursorParam });
        res.json({ topics });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // POST /api/huddles/:id/forum/topics — approved members only
  app.post(
    "/api/huddles/:id/forum/topics",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { title, body } = req.body as { title?: unknown; body?: unknown };
        if (typeof title !== "string" || typeof body !== "string") {
          res.status(400).json({ error: "title and body (strings) required" });
          return;
        }
        const poll = parsePollInput(req.body as Record<string, unknown>);
        const topic = await createTopic({
          huddleId: req.params.id!,
          userId: userId!,
          title,
          body,
          poll,
        });
        res.status(201).json({ topic });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // GET /api/huddles/:id/forum/topics/:topicId — any authenticated member
  app.get(
    "/api/huddles/:id/forum/topics/:topicId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const topic = await getTopic(req.params.id!, req.params.topicId!);
        if (!topic) {
          res.status(404).json({ error: "Topic not found" });
          return;
        }
        const poll = await getPollForTopic(req.params.id!, req.params.topicId!, userId!);
        res.json({ topic, poll });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // POST /api/huddles/:id/forum/topics/:topicId/poll/vote — approved members only
  app.post(
    "/api/huddles/:id/forum/topics/:topicId/poll/vote",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { optionIds } = req.body as { optionIds?: unknown };
        if (!Array.isArray(optionIds) || !optionIds.every((id) => typeof id === "string")) {
          res.status(400).json({ error: "optionIds (string[]) required" });
          return;
        }
        const pollId = await getPollIdForTopic(req.params.id!, req.params.topicId!);
        if (!pollId) {
          res.status(404).json({ error: "Poll not found" });
          return;
        }
        const poll = await castVote({
          huddleId: req.params.id!,
          pollId,
          userId: userId!,
          optionIds,
        });
        res.json({ poll });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // DELETE /api/huddles/:id/forum/topics/:topicId — author (no replies) or commissioner
  app.delete(
    "/api/huddles/:id/forum/topics/:topicId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        await deleteTopic({ huddleId: req.params.id!, topicId: req.params.topicId!, userId: userId! });
        res.status(204).end();
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // GET /api/huddles/:id/forum/topics/:topicId/replies?limit=&after= — any authenticated member
  app.get(
    "/api/huddles/:id/forum/topics/:topicId/replies",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { limit, cursorParam } = parsePageParams(req);
        const replies = await listReplies(req.params.id!, req.params.topicId!, {
          limit,
          after: cursorParam,
        });
        res.json({ replies });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // POST /api/huddles/:id/forum/topics/:topicId/replies — approved members only
  app.post(
    "/api/huddles/:id/forum/topics/:topicId/replies",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { body } = req.body as { body?: unknown };
        if (typeof body !== "string") {
          res.status(400).json({ error: "body (string) required" });
          return;
        }
        const reply = await createReply({
          huddleId: req.params.id!,
          topicId: req.params.topicId!,
          userId: userId!,
          body,
        });
        res.status(201).json({ reply });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // DELETE /api/huddles/:id/forum/topics/:topicId/replies/:replyId — author or commissioner
  app.delete(
    "/api/huddles/:id/forum/topics/:topicId/replies/:replyId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        await deleteReply({
          huddleId: req.params.id!,
          topicId: req.params.topicId!,
          replyId: req.params.replyId!,
          userId: userId!,
        });
        res.status(204).end();
      } catch (err) {
        handleError(err, res);
      }
    },
  );
}
