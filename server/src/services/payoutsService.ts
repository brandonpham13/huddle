/**
 * payoutsService — manage payout structure for a huddle.
 *
 * A huddle's payout structure is a list of entries each describing how part
 * of the prize pool is distributed (e.g. "1st Place $200", "Sacko -$20").
 * Commissioners can replace the full list; any member can read it.
 */
import { asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { huddlePayoutEntries, type HuddlePayoutEntry } from "../db/schema.js";
import { isCommissioner, HuddlesServiceError } from "./huddlesService.js";

const fail = (status: number, message: string): never => {
  throw new HuddlesServiceError(status, message);
};

/** Returns all payout entries for a huddle, ordered by sortOrder asc. */
export async function listPayouts(huddleId: string): Promise<HuddlePayoutEntry[]> {
  return db
    .select()
    .from(huddlePayoutEntries)
    .where(eq(huddlePayoutEntries.huddleId, huddleId))
    .orderBy(asc(huddlePayoutEntries.sortOrder));
}

export interface PayoutEntryInput {
  label: string;
  // Amount in cents (must be a non-negative integer)
  amount: number;
  sortOrder: number;
}

/**
 * Replaces all payout entries for a huddle (delete + insert).
 * Commissioner-only.
 */
export async function setPayouts(
  huddleId: string,
  userId: string,
  entries: PayoutEntryInput[],
): Promise<HuddlePayoutEntry[]> {
  if (!(await isCommissioner(huddleId, userId)))
    fail(403, "Only a commissioner can update the payout structure");

  // Validate entries
  for (const e of entries) {
    if (typeof e.label !== "string" || !e.label.trim())
      fail(400, "Each payout entry must have a non-empty label");
    if (typeof e.amount !== "number" || !Number.isInteger(e.amount) || e.amount < 0)
      fail(400, "Each payout amount must be a non-negative integer (cents)");
  }

  // Replace atomically: delete existing, then insert new rows
  await db
    .delete(huddlePayoutEntries)
    .where(eq(huddlePayoutEntries.huddleId, huddleId));

  if (entries.length === 0) return [];

  const inserted = await db
    .insert(huddlePayoutEntries)
    .values(
      entries.map((e, i) => ({
        huddleId,
        label: e.label.trim(),
        amount: e.amount,
        sortOrder: e.sortOrder ?? i,
      })),
    )
    .returning();

  return inserted.sort((a, b) => a.sortOrder - b.sortOrder);
}
