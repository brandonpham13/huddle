import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { groups, teamClaims, type Group, type TeamClaim } from '../db/schema.js'

const BCRYPT_COST = 10
const MIN_PASSWORD_LEN = 4
const MAX_PASSWORD_LEN = 128
const MAX_NAME_LEN = 80
const MAX_MESSAGE_LEN = 500

export class GroupsServiceError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const fail = (status: number, message: string): never => {
  throw new GroupsServiceError(status, message)
}

function validatePassword(pw: unknown): string {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD_LEN || pw.length > MAX_PASSWORD_LEN) {
    fail(400, `Password must be ${MIN_PASSWORD_LEN}-${MAX_PASSWORD_LEN} characters`)
  }
  return pw as string
}

function validateName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_NAME_LEN) {
    fail(400, `Name is required (max ${MAX_NAME_LEN} chars)`)
  }
  return (name as string).trim()
}

export async function createGroup(opts: {
  leagueProvider: string
  leagueId: string
  name: unknown
  password: unknown
  rosterId?: number | null
  commissionerUserId: string
}): Promise<Group> {
  const name = validateName(opts.name)
  const password = validatePassword(opts.password)
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

  const [created] = await db
    .insert(groups)
    .values({
      leagueProvider: opts.leagueProvider,
      leagueId: opts.leagueId,
      name,
      commissionerUserId: opts.commissionerUserId,
      passwordHash,
    })
    .returning()

  if (!created) fail(500, 'Failed to create group')

  // Auto-approve commissioner's own team claim if they specified one
  if (typeof opts.rosterId === 'number' && opts.rosterId > 0) {
    await db.insert(teamClaims).values({
      groupId: created!.id,
      userId: opts.commissionerUserId,
      rosterId: opts.rosterId,
      status: 'approved',
      decidedAt: new Date(),
      decidedBy: opts.commissionerUserId,
    })
  }

  return created!
}

export async function listGroupsForLeague(leagueProvider: string, leagueId: string): Promise<Group[]> {
  return db
    .select()
    .from(groups)
    .where(and(eq(groups.leagueProvider, leagueProvider), eq(groups.leagueId, leagueId)))
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const rows = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1)
  return rows[0] ?? null
}

export async function listClaimsForGroup(groupId: string): Promise<TeamClaim[]> {
  return db.select().from(teamClaims).where(eq(teamClaims.groupId, groupId))
}

export async function submitClaim(opts: {
  groupId: string
  userId: string
  password: unknown
  rosterId: unknown
  message?: unknown
}): Promise<TeamClaim> {
  const group = await getGroup(opts.groupId)
  if (!group) fail(404, 'Group not found')

  if (typeof opts.password !== 'string') fail(400, 'Password required')
  const passwordOk = await bcrypt.compare(opts.password as string, group!.passwordHash)
  if (!passwordOk) fail(403, 'Incorrect password')

  if (typeof opts.rosterId !== 'number' || !Number.isInteger(opts.rosterId) || opts.rosterId < 1) {
    fail(400, 'rosterId must be a positive integer')
  }

  let message: string | null = null
  if (opts.message !== undefined && opts.message !== null) {
    if (typeof opts.message !== 'string' || opts.message.length > MAX_MESSAGE_LEN) {
      fail(400, `message must be a string up to ${MAX_MESSAGE_LEN} chars`)
    }
    message = (opts.message as string).trim() || null
  }

  // Reject if user already has an approved claim in this group
  const existingApproved = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.groupId, opts.groupId),
        eq(teamClaims.userId, opts.userId),
        eq(teamClaims.status, 'approved'),
      ),
    )
    .limit(1)
  if (existingApproved.length > 0) fail(409, 'You already have an approved team in this group')

  // Reject if user already has a pending claim — they should wait or rescind before re-claiming
  const existingPending = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.groupId, opts.groupId),
        eq(teamClaims.userId, opts.userId),
        eq(teamClaims.status, 'pending'),
      ),
    )
    .limit(1)
  if (existingPending.length > 0) fail(409, 'You already have a pending claim in this group')

  // Reject if the roster is already approved-claimed
  const rosterTaken = await db
    .select()
    .from(teamClaims)
    .where(
      and(
        eq(teamClaims.groupId, opts.groupId),
        eq(teamClaims.rosterId, opts.rosterId as number),
        eq(teamClaims.status, 'approved'),
      ),
    )
    .limit(1)
  if (rosterTaken.length > 0) fail(409, 'That team has already been claimed')

  const [created] = await db
    .insert(teamClaims)
    .values({
      groupId: opts.groupId,
      userId: opts.userId,
      rosterId: opts.rosterId as number,
      message,
      status: 'pending',
    })
    .returning()
  if (!created) fail(500, 'Failed to submit claim')
  return created!
}

export async function decideClaim(opts: {
  groupId: string
  claimId: string
  decision: 'approved' | 'rejected'
  decidedBy: string
}): Promise<TeamClaim> {
  const group = await getGroup(opts.groupId)
  if (!group) fail(404, 'Group not found')
  if (group!.commissionerUserId !== opts.decidedBy) fail(403, 'Only the commissioner can decide claims')

  const rows = await db
    .select()
    .from(teamClaims)
    .where(and(eq(teamClaims.id, opts.claimId), eq(teamClaims.groupId, opts.groupId)))
    .limit(1)
  const claim = rows[0]
  if (!claim) fail(404, 'Claim not found')
  if (claim!.status !== 'pending') fail(409, 'Claim has already been decided')

  // For approval: ensure the roster isn't already taken (race-safety; the partial unique
  // index also guards this at the DB level)
  if (opts.decision === 'approved') {
    const rosterTaken = await db
      .select()
      .from(teamClaims)
      .where(
        and(
          eq(teamClaims.groupId, opts.groupId),
          eq(teamClaims.rosterId, claim!.rosterId),
          eq(teamClaims.status, 'approved'),
        ),
      )
      .limit(1)
    if (rosterTaken.length > 0) fail(409, 'That team has already been claimed')
  }

  const [updated] = await db
    .update(teamClaims)
    .set({ status: opts.decision, decidedAt: new Date(), decidedBy: opts.decidedBy })
    .where(eq(teamClaims.id, opts.claimId))
    .returning()
  if (!updated) fail(500, 'Failed to update claim')
  return updated!
}

export async function updateGroup(opts: {
  groupId: string
  userId: string
  name?: unknown
  password?: unknown
}): Promise<Group> {
  const group = await getGroup(opts.groupId)
  if (!group) fail(404, 'Group not found')
  if (group!.commissionerUserId !== opts.userId) fail(403, 'Only the commissioner can edit the group')

  const patch: Partial<typeof groups.$inferInsert> = { updatedAt: new Date() }
  if (opts.name !== undefined) patch.name = validateName(opts.name)
  if (opts.password !== undefined) {
    const password = validatePassword(opts.password)
    patch.passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  }

  const [updated] = await db.update(groups).set(patch).where(eq(groups.id, opts.groupId)).returning()
  if (!updated) fail(500, 'Failed to update group')
  return updated!
}

export async function deleteGroup(opts: { groupId: string; userId: string }): Promise<void> {
  const group = await getGroup(opts.groupId)
  if (!group) fail(404, 'Group not found')
  if (group!.commissionerUserId !== opts.userId) fail(403, 'Only the commissioner can delete the group')
  await db.delete(groups).where(eq(groups.id, opts.groupId))
}

