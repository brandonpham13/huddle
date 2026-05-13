/**
 * Awards service — CRUD for custom commissioner-granted awards.
 *
 * All writes are commissioner-gated via the shared isCommissioner helper
 * imported from huddlesService.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { huddleAwards, type HuddleAward } from "../db/schema.js";
import { HuddlesServiceError, isCommissioner } from "./huddlesService.js";

const fail = (status: number, message: string): never => {
  throw new HuddlesServiceError(status, message);
};

// ── Validation constants ──────────────────────────────────────────────────────

const MAX_GLYPH_LEN = 4;
const MAX_TITLE_LEN = 80;
const MAX_DESC_LEN = 300;
const HEX_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

function validateAwardInput(input: {
  rosterId: unknown;
  glyph: unknown;
  color: unknown;
  title: unknown;
  description?: unknown;
  season?: unknown;
}): {
  rosterId: number;
  glyph: string;
  color: string;
  title: string;
  description: string | null;
  season: string | null;
} {
  if (
    typeof input.rosterId !== "number" ||
    !Number.isInteger(input.rosterId) ||
    input.rosterId < 1
  ) {
    fail(400, "rosterId must be a positive integer");
  }

  if (
    typeof input.glyph !== "string" ||
    !input.glyph.trim() ||
    input.glyph.trim().length > MAX_GLYPH_LEN
  ) {
    fail(400, `glyph is required (max ${MAX_GLYPH_LEN} chars)`);
  }

  if (typeof input.color !== "string" || !HEX_RE.test(input.color)) {
    fail(400, "color must be a valid hex string (e.g. #f59e0b)");
  }

  if (
    typeof input.title !== "string" ||
    !input.title.trim() ||
    input.title.trim().length > MAX_TITLE_LEN
  ) {
    fail(400, `title is required (max ${MAX_TITLE_LEN} chars)`);
  }

  let description: string | null = null;
  if (input.description !== undefined && input.description !== null && input.description !== "") {
    if (
      typeof input.description !== "string" ||
      input.description.length > MAX_DESC_LEN
    ) {
      fail(400, `description must be a string up to ${MAX_DESC_LEN} chars`);
    }
    description = (input.description as string).trim() || null;
  }

  let season: string | null = null;
  if (input.season !== undefined && input.season !== null && input.season !== "") {
    if (typeof input.season !== "string") fail(400, "season must be a string");
    season = (input.season as string).trim() || null;
  }

  return {
    rosterId: input.rosterId as number,
    glyph: (input.glyph as string).trim(),
    color: input.color as string,
    title: (input.title as string).trim(),
    description,
    season,
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * All awards for a huddle, newest first.
 */
export async function listAwards(huddleId: string): Promise<HuddleAward[]> {
  return db
    .select()
    .from(huddleAwards)
    .where(eq(huddleAwards.huddleId, huddleId))
    .orderBy(desc(huddleAwards.createdAt));
}

/**
 * Awards for a specific roster within a huddle, newest first.
 */
export async function listAwardsForRoster(
  huddleId: string,
  rosterId: number,
): Promise<HuddleAward[]> {
  return db
    .select()
    .from(huddleAwards)
    .where(
      and(
        eq(huddleAwards.huddleId, huddleId),
        eq(huddleAwards.rosterId, rosterId),
      ),
    )
    .orderBy(desc(huddleAwards.createdAt));
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Grant a new award. Only commissioners may call this.
 */
export async function createAward(
  huddleId: string,
  userId: string,
  input: {
    rosterId: unknown;
    glyph: unknown;
    color: unknown;
    title: unknown;
    description?: unknown;
    season?: unknown;
  },
): Promise<HuddleAward> {
  if (!(await isCommissioner(huddleId, userId)))
    fail(403, "Only a commissioner can grant awards");

  const validated = validateAwardInput(input);

  const [created] = await db
    .insert(huddleAwards)
    .values({
      huddleId,
      grantedBy: userId,
      ...validated,
    })
    .returning();

  if (!created) fail(500, "Failed to create award");
  return created!;
}

/**
 * Update an existing award. Only commissioners may call this.
 */
export async function updateAward(
  huddleId: string,
  awardId: string,
  userId: string,
  input: {
    rosterId: unknown;
    glyph: unknown;
    color: unknown;
    title: unknown;
    description?: unknown;
    season?: unknown;
  },
): Promise<HuddleAward> {
  if (!(await isCommissioner(huddleId, userId)))
    fail(403, "Only a commissioner can update awards");

  const rows = await db
    .select()
    .from(huddleAwards)
    .where(and(eq(huddleAwards.id, awardId), eq(huddleAwards.huddleId, huddleId)))
    .limit(1);

  if (!rows[0]) fail(404, "Award not found");

  const validated = validateAwardInput(input);

  const [updated] = await db
    .update(huddleAwards)
    .set({ ...validated, updatedAt: new Date() })
    .where(eq(huddleAwards.id, awardId))
    .returning();

  if (!updated) fail(500, "Failed to update award");
  return updated!;
}

/**
 * Delete an award. Only commissioners may call this.
 */
export async function deleteAward(
  huddleId: string,
  awardId: string,
  userId: string,
): Promise<void> {
  if (!(await isCommissioner(huddleId, userId)))
    fail(403, "Only a commissioner can delete awards");

  const rows = await db
    .select()
    .from(huddleAwards)
    .where(
      and(
        eq(huddleAwards.id, awardId),
        eq(huddleAwards.huddleId, huddleId),
      ),
    )
    .limit(1);

  if (!rows[0]) fail(404, "Award not found");

  await db
    .delete(huddleAwards)
    .where(eq(huddleAwards.id, awardId));
}
