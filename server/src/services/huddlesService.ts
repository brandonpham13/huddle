import { randomBytes } from "crypto";
import { and, eq, count, inArray, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  huddles,
  huddleCommissioners,
  huddleAnnouncements,
  teamClaims,
  type Huddle,
  type HuddleCommissioner,
  type HuddleAnnouncement,
  type TeamClaim,
} from "../db/schema.js";

// ---- Invite code generation ----

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LEN = 6;

function generateCode(): string {
  let result = "";
  const bytes = randomBytes(INVITE_CODE_LEN * 2);
  let i = 0;
  while (result.length < INVITE_CODE_LEN) {
    const byte = bytes[i++ % bytes.length]!;
    if (byte < 256 - (256 % INVITE_ALPHABET.length)) {
      result += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
    }
  }
  return result;
}

async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    const existing = await db
      .select()
      .from(huddles)
      .where(eq(huddles.inviteCode, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
  throw new HuddlesServiceError(500, "Failed to generate unique invite code");
}

// ---- Error class ----

export class HuddlesServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const fail = (status: number, message: string): never => {
  throw new HuddlesServiceError(status, message);
};

// ---- Validation ----

const MAX_NAME_LEN = 80;
const MAX_MESSAGE_LEN = 500;

function validateName(name: unknown): string {
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > MAX_NAME_LEN
  ) {
    fail(400, `Name is required (max ${MAX_NAME_LEN} chars)`);
  }
  return (name as string).trim();
}

// ---- Commissioner helpers ----

export async function isCommissioner(
  huddleId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select()
    .from(huddleCommissioners)
    .where(
      and(
        eq(huddleCommissioners.huddleId, huddleId),
        eq(huddleCommissioners.userId, userId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function commissionerCount(huddleId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(huddleCommissioners)
    .where(eq(huddleCommissioners.huddleId, huddleId));
  return Number(rows[0]?.n ?? 0);
}

export async function listCommissioners(
  huddleId: string,
): Promise<HuddleCommissioner[]> {
  return db
    .select()
    .from(huddleCommissioners)
    .where(eq(huddleCommissioners.huddleId, huddleId));
}

// ---- Huddle CRUD ----

export async function createHuddle(opts: {
  name: unknown;
  commissionerUserId: string;
}): Promise<Huddle> {
  const name = validateName(opts.name);
  const inviteCode = await generateUniqueCode();

  const [created] = await db
    .insert(huddles)
    .values({ name, inviteCode })
    .returning();

  if (!created) fail(500, "Failed to create huddle");

  // Seed the commissioner row
  await db.insert(huddleCommissioners).values({
    huddleId: created!.id,
    userId: opts.commissionerUserId,
    addedBy: opts.commissionerUserId,
  });

  return created!;
}

export type HuddleMemberStatus = "commissioner" | "approved" | "pending";

export async function listHuddlesForUser(
  userId: string,
): Promise<{ huddle: Huddle; myStatus: HuddleMemberStatus }[]> {
  // Include pending claims so the user can see huddles they've requested to join
  const [commishRows, claimRows] = await Promise.all([
    db
      .select({ huddleId: huddleCommissioners.huddleId })
      .from(huddleCommissioners)
      .where(eq(huddleCommissioners.userId, userId)),
    db
      .select({ huddleId: teamClaims.huddleId, status: teamClaims.status })
      .from(teamClaims)
      .where(
        and(
          eq(teamClaims.userId, userId),
          inArray(teamClaims.status, ["approved", "pending"]),
        ),
      ),
  ]);

  const commishSet = new Set(commishRows.map((r) => r.huddleId));
  // If a user has both an approved and a pending claim somehow, approved wins
  const claimMap = new Map<string, "approved" | "pending">();
  for (const r of claimRows) {
    const existing = claimMap.get(r.huddleId);
    if (!existing || r.status === "approved") {
      claimMap.set(r.huddleId, r.status as "approved" | "pending");
    }
  }

  const allHuddleIds = [
    ...new Set([...commishSet, ...claimMap.keys()]),
  ];

  if (allHuddleIds.length === 0) return [];

  const huddleList = await db
    .select()
    .from(huddles)
    .where(inArray(huddles.id, allHuddleIds));

  return huddleList.map((huddle) => ({
    huddle,
    myStatus: commishSet.has(huddle.id)
      ? "commissioner"
      : (claimMap.get(huddle.id) ?? "pending"),
  }));
}

export async function linkLeague(opts: {
  huddleId: string;
  userId: string;
  leagueProvider: string;
  leagueId: string;
  leagueName?: string; // when provided, rename the huddle to the league name
}): Promise<Huddle> {
  if (!(await isCommissioner(opts.huddleId, opts.userId)))
    fail(403, "Only a commissioner can link a league");

  const patch: Partial<typeof huddles.$inferInsert> = {
    leagueProvider: opts.leagueProvider,
    leagueId: opts.leagueId,
    updatedAt: new Date(),
  };
  if (opts.leagueName) {
    patch.name = opts.leagueName.trim().slice(0, MAX_NAME_LEN);
  }

  const [updated] = await db
    .update(huddles)
    .set(patch)
    .where(eq(huddles.id, opts.huddleId))
    .returning();
  if (!updated) fail(500, "Failed to link league");
  return updated!;
}

export async function getHuddle(huddleId: string): Promise<Huddle | null> {
  const rows = await db
    .select()
    .from(huddles)
    .where(eq(huddles.id, huddleId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getHuddleByInviteCode(
  code: string,
): Promise<Huddle | null> {
  const rows = await db
    .select()
    .from(huddles)
    .where(eq(huddles.inviteCode, code.toUpperCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function listClaimsForHuddle(
  huddleId: string,
): Promise<TeamClaim[]> {
  return db.select().from(teamClaims).where(eq(teamClaims.huddleId, huddleId));
}

// ---- Claims ----

export async function submitClaim(opts: {
  huddleId: string;
  userId: string;
  rosterId: unknown;
  message?: unknown;
}): Promise<TeamClaim> {
  const huddle = await getHuddle(opts.huddleId);
  if (!huddle) fail(404, "Huddle not found");

  if (
    typeof opts.rosterId !== "number" ||
    !Number.isInteger(opts.rosterId) ||
    opts.rosterId < 1
  )
    fail(400, "rosterId must be a positive integer");

  let message: string | null = null;
  if (opts.message !== undefined && opts.message !== null) {
    if (
      typeof opts.message !== "string" ||
      opts.message.length > MAX_MESSAGE_LEN
    )
      fail(400, `message must be a string up to ${MAX_MESSAGE_LEN} chars`);
    message = (opts.message as string).trim() || null;
  }

  const existingApproved = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.huddleId, opts.huddleId),
        eq(teamClaims.userId, opts.userId),
        eq(teamClaims.status, "approved"),
      ),
    )
    .limit(1);
  if (existingApproved.length > 0)
    fail(409, "You already have an approved team in this huddle");

  const existingPending = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.huddleId, opts.huddleId),
        eq(teamClaims.userId, opts.userId),
        eq(teamClaims.status, "pending"),
      ),
    )
    .limit(1);
  if (existingPending.length > 0)
    fail(409, "You already have a pending claim in this huddle");

  const rosterTaken = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.huddleId, opts.huddleId),
        eq(teamClaims.rosterId, opts.rosterId as number),
        eq(teamClaims.status, "approved"),
      ),
    )
    .limit(1);
  if (rosterTaken.length > 0) fail(409, "That team has already been claimed");

  const [created] = await db
    .insert(teamClaims)
    .values({
      huddleId: opts.huddleId,
      userId: opts.userId,
      rosterId: opts.rosterId as number,
      message,
      status: "pending",
    })
    .returning();
  if (!created) fail(500, "Failed to submit claim");
  return created!;
}

export async function decideClaim(opts: {
  huddleId: string;
  claimId: string;
  decision: "approved" | "rejected";
  decidedBy: string;
}): Promise<TeamClaim> {
  if (!(await isCommissioner(opts.huddleId, opts.decidedBy)))
    fail(403, "Only a commissioner can decide claims");

  const rows = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.id, opts.claimId),
        eq(teamClaims.huddleId, opts.huddleId),
      ),
    )
    .limit(1);
  const claim = rows[0];
  if (!claim) fail(404, "Claim not found");
  if (claim!.status !== "pending") fail(409, "Claim has already been decided");

  if (opts.decision === "approved") {
    const rosterTaken = await db
      .select()
      .from(teamClaims)
      .where(
        and(
          eq(teamClaims.huddleId, opts.huddleId),
          eq(teamClaims.rosterId, claim!.rosterId),
          eq(teamClaims.status, "approved"),
        ),
      )
      .limit(1);
    if (rosterTaken.length > 0) fail(409, "That team has already been claimed");
  }

  const [updated] = await db
    .update(teamClaims)
    .set({
      status: opts.decision,
      decidedAt: new Date(),
      decidedBy: opts.decidedBy,
    })
    .where(eq(teamClaims.id, opts.claimId))
    .returning();
  if (!updated) fail(500, "Failed to update claim");
  return updated!;
}

// ---- Commissioner management ----

export async function addCommissioner(opts: {
  huddleId: string;
  newUserId: string;
  actingUserId: string;
}): Promise<HuddleCommissioner> {
  if (!(await isCommissioner(opts.huddleId, opts.actingUserId)))
    fail(403, "Only a commissioner can add co-commissioners");

  // Check the new commissioner has an approved claim
  const hasClaim = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.huddleId, opts.huddleId),
        eq(teamClaims.userId, opts.newUserId),
        eq(teamClaims.status, "approved"),
      ),
    )
    .limit(1);
  if (hasClaim.length === 0)
    fail(400, "User must have an approved team claim to become a commissioner");

  const [row] = await db
    .insert(huddleCommissioners)
    .values({
      huddleId: opts.huddleId,
      userId: opts.newUserId,
      addedBy: opts.actingUserId,
    })
    .onConflictDoNothing()
    .returning();

  // onConflictDoNothing returns nothing if already a commissioner — fetch it
  if (!row) {
    const existing = await db
      .select()
      .from(huddleCommissioners)
      .where(
        and(
          eq(huddleCommissioners.huddleId, opts.huddleId),
          eq(huddleCommissioners.userId, opts.newUserId),
        ),
      )
      .limit(1);
    return existing[0]!;
  }
  return row;
}

export async function removeCommissioner(opts: {
  huddleId: string;
  targetUserId: string;
  actingUserId: string;
}): Promise<void> {
  if (!(await isCommissioner(opts.huddleId, opts.actingUserId)))
    fail(403, "Only a commissioner can remove commissioners");

  // Last-commish guard
  const n = await commissionerCount(opts.huddleId);
  if (n <= 1)
    fail(409, "Cannot remove the last commissioner — assign another first");

  await db
    .delete(huddleCommissioners)
    .where(
      and(
        eq(huddleCommissioners.huddleId, opts.huddleId),
        eq(huddleCommissioners.userId, opts.targetUserId),
      ),
    );
}

// ---- Huddle settings ----

export async function updateHuddle(opts: {
  huddleId: string;
  userId: string;
  name?: unknown;
}): Promise<Huddle> {
  if (!(await isCommissioner(opts.huddleId, opts.userId)))
    fail(403, "Only a commissioner can edit the huddle");

  const patch: Partial<typeof huddles.$inferInsert> = { updatedAt: new Date() };
  if (opts.name !== undefined) patch.name = validateName(opts.name);

  const [updated] = await db
    .update(huddles)
    .set(patch)
    .where(eq(huddles.id, opts.huddleId))
    .returning();
  if (!updated) fail(500, "Failed to update huddle");
  return updated!;
}

export async function rotateInviteCode(opts: {
  huddleId: string;
  userId: string;
}): Promise<Huddle> {
  if (!(await isCommissioner(opts.huddleId, opts.userId)))
    fail(403, "Only a commissioner can rotate the invite code");

  const newCode = await generateUniqueCode();
  const [updated] = await db
    .update(huddles)
    .set({
      inviteCode: newCode,
      inviteCodeUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(huddles.id, opts.huddleId))
    .returning();
  if (!updated) fail(500, "Failed to rotate invite code");
  return updated!;
}

export async function deleteHuddle(opts: {
  huddleId: string;
  userId: string;
}): Promise<void> {
  if (!(await isCommissioner(opts.huddleId, opts.userId)))
    fail(403, "Only a commissioner can delete the huddle");
  await db.delete(huddles).where(eq(huddles.id, opts.huddleId));
}

// ---- Announcements ----

const MAX_ANNOUNCEMENT_TITLE_LEN = 120;
const MAX_ANNOUNCEMENT_BODY_LEN = 2000;

export async function createAnnouncement(opts: {
  huddleId: string;
  userId: string;
  title: unknown;
  body: unknown;
}): Promise<HuddleAnnouncement> {
  if (!(await isCommissioner(opts.huddleId, opts.userId)))
    fail(403, "Only a commissioner can post announcements");

  if (
    typeof opts.title !== "string" ||
    !opts.title.trim() ||
    opts.title.trim().length > MAX_ANNOUNCEMENT_TITLE_LEN
  )
    fail(400, `title is required (max ${MAX_ANNOUNCEMENT_TITLE_LEN} chars)`);

  if (
    typeof opts.body !== "string" ||
    !opts.body.trim() ||
    opts.body.trim().length > MAX_ANNOUNCEMENT_BODY_LEN
  )
    fail(400, `body is required (max ${MAX_ANNOUNCEMENT_BODY_LEN} chars)`);

  const [created] = await db
    .insert(huddleAnnouncements)
    .values({
      huddleId: opts.huddleId,
      authorId: opts.userId,
      title: (opts.title as string).trim(),
      body: (opts.body as string).trim(),
    })
    .returning();
  if (!created) fail(500, "Failed to create announcement");
  return created!;
}

export async function listAnnouncements(
  huddleId: string,
  limit = 10,
): Promise<HuddleAnnouncement[]> {
  return db
    .select()
    .from(huddleAnnouncements)
    .where(eq(huddleAnnouncements.huddleId, huddleId))
    .orderBy(desc(huddleAnnouncements.createdAt))
    .limit(limit);
}

export async function deleteAnnouncement(opts: {
  huddleId: string;
  announcementId: string;
  userId: string;
}): Promise<void> {
  if (!(await isCommissioner(opts.huddleId, opts.userId)))
    fail(403, "Only a commissioner can delete announcements");

  const rows = await db
    .select()
    .from(huddleAnnouncements)
    .where(
      and(
        eq(huddleAnnouncements.id, opts.announcementId),
        eq(huddleAnnouncements.huddleId, opts.huddleId),
      ),
    )
    .limit(1);
  if (!rows[0]) fail(404, "Announcement not found");

  await db
    .delete(huddleAnnouncements)
    .where(eq(huddleAnnouncements.id, opts.announcementId));
}

// Self-unclaim: user removes their own pending or approved claim
export async function unclaimTeam(opts: {
  huddleId: string;
  claimId: string;
  userId: string;
}): Promise<void> {
  const rows = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.id, opts.claimId),
        eq(teamClaims.huddleId, opts.huddleId),
        eq(teamClaims.userId, opts.userId),
      ),
    )
    .limit(1);
  if (!rows[0]) fail(404, "Claim not found");
  if (rows[0].status === "rejected")
    fail(409, "Claim has already been rejected");
  await db.delete(teamClaims).where(eq(teamClaims.id, opts.claimId));
}

// Commissioner force-remove: remove any claim regardless of owner
export async function forceRemoveClaim(opts: {
  huddleId: string;
  claimId: string;
  actingUserId: string;
}): Promise<void> {
  if (!(await isCommissioner(opts.huddleId, opts.actingUserId)))
    fail(403, "Only a commissioner can remove team assignments");
  const rows = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.id, opts.claimId),
        eq(teamClaims.huddleId, opts.huddleId),
      ),
    )
    .limit(1);
  if (!rows[0]) fail(404, "Claim not found");
  // Guard: commissioner cannot unlink themselves if they're the last commissioner
  if (rows[0].userId === opts.actingUserId) {
    const n = await commissionerCount(opts.huddleId);
    if (n <= 1)
      fail(
        409,
        "You can't unlink yourself while you're the only commissioner — assign another commissioner first",
      );
  }
  await db.delete(teamClaims).where(eq(teamClaims.id, opts.claimId));
}
