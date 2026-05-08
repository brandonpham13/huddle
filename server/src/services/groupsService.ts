import { and, eq, ne } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  groups,
  teamClaims,
  type Group,
  type TeamClaim,
} from "../db/schema.js";
import { randomBytes } from "crypto";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LEN = 6;

// 6-char uppercase alphanumeric invite codes (no 0/O/1/I to avoid confusion)
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

const MAX_NAME_LEN = 80;
const MAX_MESSAGE_LEN = 500;

export class GroupsServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const fail = (status: number, message: string): never => {
  throw new GroupsServiceError(status, message);
};

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

async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    const existing = await db
      .select()
      .from(groups)
      .where(eq(groups.inviteCode, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
  return fail(500, "Failed to generate unique invite code");
}

// ---- CRUD ----

export async function createGroup(opts: {
  leagueProvider: string;
  leagueId: string;
  name: unknown;
  rosterId?: number | null;
  commissionerUserId: string;
}): Promise<Group> {
  const name = validateName(opts.name);
  const inviteCode = await generateUniqueCode();

  const [created] = await db
    .insert(groups)
    .values({
      leagueProvider: opts.leagueProvider,
      leagueId: opts.leagueId,
      name,
      commissionerUserId: opts.commissionerUserId,
      inviteCode,
    })
    .returning();

  if (!created) fail(500, "Failed to create group");

  // Auto-approve commissioner's own team claim if they specified one
  if (typeof opts.rosterId === "number" && opts.rosterId > 0) {
    await db.insert(teamClaims).values({
      groupId: created!.id,
      userId: opts.commissionerUserId,
      rosterId: opts.rosterId,
      status: "approved",
      decidedAt: new Date(),
      decidedBy: opts.commissionerUserId,
    });
  }

  return created!;
}

export async function listGroupsForLeague(
  leagueProvider: string,
  leagueId: string,
): Promise<Group[]> {
  return db
    .select()
    .from(groups)
    .where(
      and(
        eq(groups.leagueProvider, leagueProvider),
        eq(groups.leagueId, leagueId),
      ),
    );
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const rows = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getGroupByInviteCode(
  code: string,
): Promise<Group | null> {
  const rows = await db
    .select()
    .from(groups)
    .where(eq(groups.inviteCode, code.toUpperCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function listClaimsForGroup(
  groupId: string,
): Promise<TeamClaim[]> {
  return db.select().from(teamClaims).where(eq(teamClaims.groupId, groupId));
}

// ---- Claims ----

export async function submitClaim(opts: {
  groupId: string;
  userId: string;
  inviteCode: unknown;
  rosterId: unknown;
  message?: unknown;
}): Promise<TeamClaim> {
  const group = await getGroup(opts.groupId);
  if (!group) fail(404, "Group not found");

  if (typeof opts.inviteCode !== "string") fail(400, "Invite code required");
  if ((opts.inviteCode as string).toUpperCase() !== group!.inviteCode)
    fail(403, "Invalid invite code");

  if (
    typeof opts.rosterId !== "number" ||
    !Number.isInteger(opts.rosterId) ||
    opts.rosterId < 1
  ) {
    fail(400, "rosterId must be a positive integer");
  }

  let message: string | null = null;
  if (opts.message !== undefined && opts.message !== null) {
    if (
      typeof opts.message !== "string" ||
      opts.message.length > MAX_MESSAGE_LEN
    ) {
      fail(400, `message must be a string up to ${MAX_MESSAGE_LEN} chars`);
    }
    message = (opts.message as string).trim() || null;
  }

  // Reject if user already has an approved claim in this group
  const existingApproved = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.groupId, opts.groupId),
        eq(teamClaims.userId, opts.userId),
        eq(teamClaims.status, "approved"),
      ),
    )
    .limit(1);
  if (existingApproved.length > 0)
    fail(409, "You already have an approved team in this group");

  // Reject if user already has a pending claim
  const existingPending = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.groupId, opts.groupId),
        eq(teamClaims.userId, opts.userId),
        eq(teamClaims.status, "pending"),
      ),
    )
    .limit(1);
  if (existingPending.length > 0)
    fail(409, "You already have a pending claim in this group");

  // Reject if the roster is already approved-claimed
  const rosterTaken = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.groupId, opts.groupId),
        eq(teamClaims.rosterId, opts.rosterId as number),
        eq(teamClaims.status, "approved"),
      ),
    )
    .limit(1);
  if (rosterTaken.length > 0) fail(409, "That team has already been claimed");

  const [created] = await db
    .insert(teamClaims)
    .values({
      groupId: opts.groupId,
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
  groupId: string;
  claimId: string;
  decision: "approved" | "rejected";
  decidedBy: string;
}): Promise<TeamClaim> {
  const group = await getGroup(opts.groupId);
  if (!group) fail(404, "Group not found");
  if (group!.commissionerUserId !== opts.decidedBy)
    fail(403, "Only the commissioner can decide claims");

  const rows = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.id, opts.claimId),
        eq(teamClaims.groupId, opts.groupId),
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
          eq(teamClaims.groupId, opts.groupId),
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

export async function revokeTeamOwner(opts: {
  groupId: string;
  claimId: string;
  revokedBy: string;
}): Promise<TeamClaim> {
  const group = await getGroup(opts.groupId);
  if (!group) fail(404, "Group not found");
  if (group!.commissionerUserId !== opts.revokedBy)
    fail(403, "Only the commissioner can revoke owners");

  const rows = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.id, opts.claimId),
        eq(teamClaims.groupId, opts.groupId),
      ),
    )
    .limit(1);
  const claim = rows[0];
  if (!claim) fail(404, "Claim not found");
  if (claim!.status !== "approved")
    fail(409, "Can only revoke approved claims");

  const [updated] = await db
    .update(teamClaims)
    .set({
      status: "revoked",
      decidedAt: new Date(),
      decidedBy: opts.revokedBy,
    })
    .where(eq(teamClaims.id, opts.claimId))
    .returning();
  if (!updated) fail(500, "Failed to revoke claim");
  return updated!;
}

export async function promoteCommissioner(opts: {
  groupId: string;
  newCommissionerUserId: string;
  currentUserId: string;
}): Promise<Group> {
  const group = await getGroup(opts.groupId);
  if (!group) fail(404, "Group not found");
  if (group!.commissionerUserId !== opts.currentUserId)
    fail(403, "Only the current commissioner can promote");
  if (group!.commissionerUserId === opts.newCommissionerUserId)
    fail(400, "That user is already the commissioner");

  // Verify the new commissioner has an approved claim in the group
  const hasClaim = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.groupId, opts.groupId),
        eq(teamClaims.userId, opts.newCommissionerUserId),
        eq(teamClaims.status, "approved"),
      ),
    )
    .limit(1);
  if (hasClaim.length === 0)
    fail(
      400,
      "New commissioner must have an approved team claim in this group",
    );

  const [updated] = await db
    .update(groups)
    .set({
      commissionerUserId: opts.newCommissionerUserId,
      updatedAt: new Date(),
    })
    .where(eq(groups.id, opts.groupId))
    .returning();
  if (!updated) fail(500, "Failed to promote commissioner");
  return updated!;
}

// ---- Group settings ----

export async function updateGroup(opts: {
  groupId: string;
  userId: string;
  name?: unknown;
}): Promise<Group> {
  const group = await getGroup(opts.groupId);
  if (!group) fail(404, "Group not found");
  if (group!.commissionerUserId !== opts.userId)
    fail(403, "Only the commissioner can edit the group");

  const patch: Partial<typeof groups.$inferInsert> = { updatedAt: new Date() };
  if (opts.name !== undefined) patch.name = validateName(opts.name);

  const [updated] = await db
    .update(groups)
    .set(patch)
    .where(eq(groups.id, opts.groupId))
    .returning();
  if (!updated) fail(500, "Failed to update group");
  return updated!;
}

export async function rotateInviteCode(opts: {
  groupId: string;
  userId: string;
}): Promise<Group> {
  const group = await getGroup(opts.groupId);
  if (!group) fail(404, "Group not found");
  if (group!.commissionerUserId !== opts.userId)
    fail(403, "Only the commissioner can rotate the invite code");

  const newCode = await generateUniqueCode();
  const [updated] = await db
    .update(groups)
    .set({
      inviteCode: newCode,
      inviteCodeUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(groups.id, opts.groupId))
    .returning();
  if (!updated) fail(500, "Failed to rotate invite code");
  return updated!;
}

export async function deleteGroup(opts: {
  groupId: string;
  userId: string;
}): Promise<void> {
  const group = await getGroup(opts.groupId);
  if (!group) fail(404, "Group not found");
  if (group!.commissionerUserId !== opts.userId)
    fail(403, "Only the commissioner can delete the group");
  await db.delete(groups).where(eq(groups.id, opts.groupId));
}
