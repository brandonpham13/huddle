import { type Express, type Request, type Response } from "express";
import { getAuth, createClerkClient } from "@clerk/express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  HuddlesServiceError,
  addCommissioner,
  createAnnouncement,
  createHuddle,
  decideClaim,
  deleteAnnouncement,
  deleteHuddle,
  forceRemoveClaim,
  getHuddle,
  getHuddleByInviteCode,
  isCommissioner,
  listAnnouncements,
  listClaimsForHuddle,
  listCommissioners,
  listHuddlesForUser,
  linkLeague,
  removeCommissioner,
  rotateInviteCode,
  submitClaim,
  unclaimTeam,
  updateHuddle,
  type HuddleMemberStatus,
} from "../services/huddlesService.js";
import {
  getDuesConfig,
  getDuesPayments,
  setDuesConfig,
  setDuesPaid,
} from "../services/duesService.js";
import {
  listAwards,
  listAwardsForRoster,
  createAward,
  deleteAward,
} from "../services/awardsService.js";

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

function serializeHuddle(
  h: {
    id: string;
    leagueProvider: string | null;
    leagueId: string | null;
    name: string;
    inviteCode: string;
    inviteCodeUpdatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  },
  includeCode: boolean,
) {
  return {
    id: h.id,
    leagueProvider: h.leagueProvider,
    leagueId: h.leagueId,
    name: h.name,
    ...(includeCode
      ? { inviteCode: h.inviteCode, inviteCodeUpdatedAt: h.inviteCodeUpdatedAt }
      : {}),
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

export function initHuddleRoutes(app: Express) {
  // POST /api/huddles — name is auto-generated from the user's Clerk display name
  app.post("/api/huddles", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req);
      const clerkUser = await clerkClient.users.getUser(userId!);
      const handle =
        clerkUser.username ??
        clerkUser.firstName ??
        clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0] ??
        "Your";
      const name = `${handle}'s Huddle`;
      const huddle = await createHuddle({ name, commissionerUserId: userId! });
      res.status(201).json({ huddle: serializeHuddle(huddle, true) });
    } catch (err) {
      handleError(err, res);
    }
  });

  // GET /api/huddles — returns all huddles the user is a member of
  app.get("/api/huddles", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req);
      const list = await listHuddlesForUser(userId!);
      res.json({
        huddles: list.map(({ huddle, myStatus }) => ({
          ...serializeHuddle(huddle, false),
          myStatus,
        })),
      });
    } catch (err) {
      handleError(err, res);
    }
  });

  // GET /api/huddles/lookup?code=ABC123
  app.get(
    "/api/huddles/lookup",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const code = req.query["code"];
        if (typeof code !== "string" || !code) {
          res.status(400).json({ error: "code query param required" });
          return;
        }
        const huddle = await getHuddleByInviteCode(code);
        if (!huddle) {
          res.status(404).json({ error: "No huddle found with that invite code" });
          return;
        }
        // Check if the user is already a member (approved claim or commissioner)
        const [existingClaims, commishRows] = await Promise.all([
          listClaimsForHuddle(huddle.id),
          listCommissioners(huddle.id),
        ]);
        const alreadyMember =
          existingClaims.some((c) => c.userId === userId && c.status === "approved") ||
          commishRows.some((c) => c.userId === userId);
        if (alreadyMember) {
          res.status(409).json({ error: "You're already a member of this huddle" });
          return;
        }
        res.json({ huddle: serializeHuddle(huddle, false) });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // PATCH /api/huddles/:id/league — commissioner links a Sleeper league
  app.patch(
    "/api/huddles/:id/league",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { leagueProvider, leagueId, leagueName } = req.body as {
          leagueProvider?: string;
          leagueId?: string;
          leagueName?: string;
        };
        if (typeof leagueProvider !== "string" || !leagueProvider) {
          res.status(400).json({ error: "leagueProvider required" });
          return;
        }
        if (typeof leagueId !== "string" || !leagueId) {
          res.status(400).json({ error: "leagueId required" });
          return;
        }
        const huddle = await linkLeague({
          huddleId: req.params.id!,
          userId: userId!,
          leagueProvider,
          leagueId,
          leagueName: typeof leagueName === "string" && leagueName ? leagueName : undefined,
        });
        res.json({ huddle: serializeHuddle(huddle, true) });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // GET /api/huddles/:id
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

        const [claims, commissioners] = await Promise.all([
          listClaimsForHuddle(huddleId),
          listCommissioners(huddleId),
        ]);
        const userIsCommissioner = await isCommissioner(huddleId, userId!);

        const allUserIds = [
          ...commissioners.map((c) => c.userId),
          ...claims.map((c) => c.userId),
        ];
        const userMap = await fetchUserSummaries(allUserIds);
        const myClaim = claims.find((c) => c.userId === userId) ?? null;

        res.json({
          huddle: {
            ...serializeHuddle(huddle, userIsCommissioner),
            isCommissioner: userIsCommissioner,
            commissioners: commissioners.map((c) => ({
              userId: c.userId,
              addedAt: c.addedAt,
              user: userMap.get(c.userId) ?? {
                id: c.userId,
                username: null,
                email: null,
              },
            })),
          },
          claims: claims.map((c) => ({
            id: c.id,
            rosterId: c.rosterId,
            status: c.status,
            message: c.message,
            createdAt: c.createdAt,
            decidedAt: c.decidedAt,
            user:
              userIsCommissioner ||
              c.userId === userId ||
              c.status === "approved"
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

  // POST /api/huddles/:id/claims
  app.post(
    "/api/huddles/:id/claims",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { rosterId, message } = req.body as {
          rosterId?: number;
          message?: string;
        };
        const claim = await submitClaim({
          huddleId: req.params.id!,
          userId: userId!,
          rosterId,
          message,
        });
        res.status(201).json({ claim: serializeClaim(claim) });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // GET /api/huddles/:id/claims — commissioner only
  app.get(
    "/api/huddles/:id/claims",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const huddleId = req.params.id!;
        if (!(await isCommissioner(huddleId, userId!))) {
          res
            .status(403)
            .json({ error: "Only a commissioner can list claims" });
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

  // POST /api/huddles/:id/claims/:claimId/decide
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

  // DELETE /api/huddles/:id/claims/:claimId — self-unclaim
  app.delete(
    "/api/huddles/:id/claims/:claimId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        await unclaimTeam({
          huddleId: req.params.id!,
          claimId: req.params.claimId!,
          userId: userId!,
        });
        res.status(204).end();
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // DELETE /api/huddles/:id/claims/:claimId/force — commissioner removes any claim
  app.delete(
    "/api/huddles/:id/claims/:claimId/force",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        await forceRemoveClaim({
          huddleId: req.params.id!,
          claimId: req.params.claimId!,
          actingUserId: userId!,
        });
        res.status(204).end();
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // GET /api/huddles/:id/commissioners
  app.get(
    "/api/huddles/:id/commissioners",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const commissioners = await listCommissioners(req.params.id!);
        const userMap = await fetchUserSummaries(
          commissioners.map((c) => c.userId),
        );
        res.json({
          commissioners: commissioners.map((c) => ({
            userId: c.userId,
            addedAt: c.addedAt,
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

  // POST /api/huddles/:id/commissioners — add co-commissioner
  app.post(
    "/api/huddles/:id/commissioners",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { newUserId } = req.body as { newUserId?: string };
        if (typeof newUserId !== "string" || !newUserId) {
          res.status(400).json({ error: "newUserId required" });
          return;
        }
        const row = await addCommissioner({
          huddleId: req.params.id!,
          newUserId,
          actingUserId: userId!,
        });
        const userMap = await fetchUserSummaries([row.userId]);
        res.status(201).json({
          commissioner: {
            userId: row.userId,
            addedAt: row.addedAt,
            user: userMap.get(row.userId) ?? {
              id: row.userId,
              username: null,
              email: null,
            },
          },
        });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // DELETE /api/huddles/:id/commissioners/:targetUserId — remove commissioner
  app.delete(
    "/api/huddles/:id/commissioners/:targetUserId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        await removeCommissioner({
          huddleId: req.params.id!,
          targetUserId: req.params.targetUserId!,
          actingUserId: userId!,
        });
        res.status(204).end();
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // POST /api/huddles/:id/rotate-code
  app.post(
    "/api/huddles/:id/rotate-code",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const huddle = await rotateInviteCode({
          huddleId: req.params.id!,
          userId: userId!,
        });
        res.json({ huddle: serializeHuddle(huddle, true) });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // PATCH /api/huddles/:id
  app.patch(
    "/api/huddles/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { name } = req.body as { name?: string };
        const huddle = await updateHuddle({
          huddleId: req.params.id!,
          userId: userId!,
          name,
        });
        res.json({ huddle: serializeHuddle(huddle, true) });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // DELETE /api/huddles/:id
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


  // POST /api/huddles/:id/announcements — commissioner only
  app.post(
    "/api/huddles/:id/announcements",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { title, body } = req.body as { title?: unknown; body?: unknown };
        const announcement = await createAnnouncement({
          huddleId: req.params.id!,
          userId: userId!,
          title,
          body,
        });
        res.status(201).json({ announcement });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // GET /api/huddles/:id/announcements — any authenticated member
  app.get(
    "/api/huddles/:id/announcements",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const limitParam = req.query["limit"];
        const limit =
          typeof limitParam === "string" && /^\d+$/.test(limitParam)
            ? Math.min(Number(limitParam), 50)
            : 10;
        const announcements = await listAnnouncements(req.params.id!, limit);
        res.json({ announcements });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // DELETE /api/huddles/:id/announcements/:announcementId — commissioner only
  app.delete(
    "/api/huddles/:id/announcements/:announcementId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        await deleteAnnouncement({
          huddleId: req.params.id!,
          announcementId: req.params.announcementId!,
          userId: userId!,
        });
        res.status(204).end();
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // GET /api/huddles/:id/dues — auth required, returns { config, payments }
  app.get(
    "/api/huddles/:id/dues",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const huddleId = req.params.id!;
        const [config, payments] = await Promise.all([
          getDuesConfig(huddleId),
          getDuesPayments(huddleId),
        ]);
        res.json({ config, payments });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // PUT /api/huddles/:id/dues/config — commissioner only
  app.put(
    "/api/huddles/:id/dues/config",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const { amount, season, note } = req.body as {
          amount?: unknown;
          season?: string | null;
          note?: string | null;
        };
        if (typeof amount !== "number") {
          res.status(400).json({ error: "amount (number, cents) required" });
          return;
        }
        const config = await setDuesConfig(req.params.id!, userId!, {
          amount,
          season,
          note,
        });
        res.json({ config });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // PUT /api/huddles/:id/dues/payments/:rosterId — commissioner only
  app.put(
    "/api/huddles/:id/dues/payments/:rosterId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const rosterId = parseInt(req.params.rosterId!, 10);
        if (isNaN(rosterId)) {
          res.status(400).json({ error: "Invalid rosterId" });
          return;
        }
        const { paid, note } = req.body as { paid?: boolean; note?: string };
        if (typeof paid !== "boolean") {
          res.status(400).json({ error: "paid (boolean) required" });
          return;
        }
        const payment = await setDuesPaid(
          req.params.id!,
          userId!,
          rosterId,
          paid,
          note,
        );
        res.json({ payment });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // GET /api/huddles/:id/awards — all members; ?rosterId=N for team-page filter
  app.get(
    "/api/huddles/:id/awards",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const huddleId = req.params.id!;
        const rosterIdParam = req.query["rosterId"];
        let awards;
        if (rosterIdParam !== undefined) {
          const rosterId = Number(rosterIdParam);
          if (!Number.isInteger(rosterId) || rosterId < 1) {
            res.status(400).json({ error: "rosterId must be a positive integer" });
            return;
          }
          awards = await listAwardsForRoster(huddleId, rosterId);
        } else {
          awards = await listAwards(huddleId);
        }
        res.json({ awards });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // POST /api/huddles/:id/awards — commissioner only
  app.post(
    "/api/huddles/:id/awards",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        const huddleId = req.params.id!;
        const { rosterId, glyph, color, title, description, season } =
          req.body as Record<string, unknown>;
        const award = await createAward(huddleId, userId!, {
          rosterId,
          glyph,
          color,
          title,
          description,
          season,
        });
        res.status(201).json({ award });
      } catch (err) {
        handleError(err, res);
      }
    },
  );

  // DELETE /api/huddles/:id/awards/:awardId — commissioner only
  app.delete(
    "/api/huddles/:id/awards/:awardId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = getAuth(req);
        await deleteAward(req.params.id!, req.params.awardId!, userId!);
        res.status(204).end();
      } catch (err) {
        handleError(err, res);
      }
    },
  );
}
