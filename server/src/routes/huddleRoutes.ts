import { type Express, type Request, type Response } from "express";
import { getAuth, createClerkClient } from "@clerk/express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  HuddlesServiceError,
  createHuddle,
  decideClaim,
  deleteHuddle,
  getHuddle,
  listClaimsForHuddle,
  listHuddlesForLeague,
  submitClaim,
  updateHuddle,
} from "../services/huddlesService.js";

const clerkSecretKey = process.env["CLERK_SECRET_KEY"];
if (!clerkSecretKey) {
  throw new Error("Missing required environment variable: CLERK_SECRET_KEY");
}
const clerkClient = createClerkClient({ secretKey: clerkSecretKey });

interface ClerkUserSummary {
  id: string;
  username: string | null;
  email: string | null;
}

async function fetchUserSummaries(
  userIds: string[],
): Promise<Map<string, ClerkUserSummary>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const result = new Map<string, ClerkUserSummary>();
  const list = await clerkClient.users.getUserList({
    userId: unique,
    limit: unique.length,
  });
  for (const u of list.data) {
    result.set(u.id, {
      id: u.id,
      username: u.username,
      email:
        u.primaryEmailAddress?.emailAddress ??
        u.emailAddresses[0]?.emailAddress ??
        null,
    });
  }
  return result;
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof HuddlesServiceError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error("huddleRoutes error:", err);
  res.status(500).json({ error: "Internal error" });
}

export function initHuddleRoutes(app: Express) {
  // POST /api/huddles — create a huddle for a league
  app.post("/api/huddles", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req);
      const { leagueProvider, leagueId, name, password, rosterId } =
        req.body as {
          leagueProvider?: string;
          leagueId?: string;
          name?: string;
          password?: string;
          rosterId?: number | null;
        };
      if (typeof leagueProvider !== "string" || !leagueProvider) {
        res.status(400).json({ error: "leagueProvider required" });
        return;
      }
      if (typeof leagueId !== "string" || !leagueId) {
        res.status(400).json({ error: "leagueId required" });
        return;
      }
      const huddle = await createHuddle({
        leagueProvider,
        leagueId,
        name,
        password,
        rosterId: rosterId ?? null,
        commissionerUserId: userId!,
      });
      res.status(201).json({ huddle: serializeHuddle(huddle) });
    } catch (err) {
      handleError(err, res);
    }
  });

  // GET /api/huddles?leagueProvider=sleeper&leagueId=123 — list huddles for a league
  app.get("/api/huddles", requireAuth, async (req: Request, res: Response) => {
    try {
      const leagueProvider = req.query["leagueProvider"];
      const leagueId = req.query["leagueId"];
      if (typeof leagueProvider !== "string" || typeof leagueId !== "string") {
        res
          .status(400)
          .json({ error: "leagueProvider and leagueId query params required" });
        return;
      }
      const list = await listHuddlesForLeague(leagueProvider, leagueId);
      res.json({ huddles: list.map(serializeHuddle) });
    } catch (err) {
      handleError(err, res);
    }
  });

  // GET /api/huddles/:id — huddle detail with claim summary
  app.get(
    "/api/huddles/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const huddleId = req.params.id!;
        const huddle = await getHuddle(huddleId);
        if (!huddle) {
          res.status(404).json({ error: "Huddle not found" });
          return;
        }

        const claims = await listClaimsForHuddle(huddleId);
        const isCommissioner = huddle.commissionerUserId === userId;

        const claimerIds = [
          huddle.commissionerUserId,
          ...claims.map((c) => c.userId),
        ];
        const userMap = await fetchUserSummaries(claimerIds);

        const myClaim = claims.find((c) => c.userId === userId) ?? null;

        res.json({
          huddle: {
            ...serializeHuddle(huddle),
            commissioner: userMap.get(huddle.commissionerUserId) ?? {
              id: huddle.commissionerUserId,
              username: null,
              email: null,
            },
            isCommissioner,
          },
          claims: claims.map((c) => ({
            id: c.id,
            rosterId: c.rosterId,
            status: c.status,
            message: c.message,
            createdAt: c.createdAt,
            decidedAt: c.decidedAt,
            user:
              isCommissioner || c.userId === userId
                ? (userMap.get(c.userId) ?? {
                    id: c.userId,
                    username: null,
                    email: null,
                  })
                : null,
          })),
          myClaim: myClaim
            ? {
                id: myClaim.id,
                rosterId: myClaim.rosterId,
                status: myClaim.status,
              }
            : null,
        });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // POST /api/huddles/:id/claims — submit a team claim with the huddle password
  app.post(
    "/api/huddles/:id/claims",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { password, rosterId, message } = req.body as {
          password?: string;
          rosterId?: number;
          message?: string;
        };
        const claim = await submitClaim({
          huddleId: req.params.id!,
          userId: userId!,
          password,
          rosterId,
          message,
        });
        res.status(201).json({ claim: serializeClaim(claim) });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // GET /api/huddles/:id/claims — commissioner-only pending list with claimer identities
  app.get(
    "/api/huddles/:id/claims",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const huddleId = req.params.id!;
        const huddle = await getHuddle(huddleId);
        if (!huddle) {
          res.status(404).json({ error: "Huddle not found" });
          return;
        }
        if (huddle.commissionerUserId !== userId) {
          res
            .status(403)
            .json({ error: "Only the commissioner can list claims" });
          return;
        }
        const claims = await listClaimsForHuddle(huddleId);
        const userMap = await fetchUserSummaries(claims.map((c) => c.userId));
        res.json({
          claims: claims.map((c) => ({
            ...serializeClaim(c),
            user: userMap.get(c.userId) ?? {
              id: c.userId,
              username: null,
              email: null,
            },
          })),
        });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // POST /api/huddles/:id/claims/:claimId/decide — commissioner approves/rejects
  app.post(
    "/api/huddles/:id/claims/:claimId/decide",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { decision } = req.body as { decision?: string };
        if (decision !== "approved" && decision !== "rejected") {
          res
            .status(400)
            .json({ error: 'decision must be "approved" or "rejected"' });
          return;
        }
        const claim = await decideClaim({
          huddleId: req.params.id!,
          claimId: req.params.claimId!,
          decision,
          decidedBy: userId!,
        });
        res.json({ claim: serializeClaim(claim) });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // PATCH /api/huddles/:id — commissioner edits name and/or rotates password
  app.patch(
    "/api/huddles/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { name, password } = req.body as {
          name?: string;
          password?: string;
        };
        const huddle = await updateHuddle({
          huddleId: req.params.id!,
          userId: userId!,
          name,
          password,
        });
        res.json({ huddle: serializeHuddle(huddle) });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // DELETE /api/huddles/:id — commissioner deletes huddle (cascades claims)
  app.delete(
    "/api/huddles/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        await deleteHuddle({ huddleId: req.params.id!, userId: userId! });
        res.status(204).end();
      } catch (err) {
        handleError(err, res);
      }
    },
  );
}

function serializeHuddle(h: {
  id: string;
  leagueProvider: string;
  leagueId: string;
  name: string;
  commissionerUserId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: h.id,
    leagueProvider: h.leagueProvider,
    leagueId: h.leagueId,
    name: h.name,
    commissionerUserId: h.commissionerUserId,
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
  };
}

function serializeClaim(c: {
  id: string;
  huddleId: string;
  rosterId: number;
  status: string;
  message: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  userId: string;
}) {
  return {
    id: c.id,
    huddleId: c.huddleId,
    rosterId: c.rosterId,
    status: c.status,
    message: c.message,
    userId: c.userId,
    createdAt: c.createdAt,
    decidedAt: c.decidedAt,
  };
}
