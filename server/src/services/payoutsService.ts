/**
 * payoutsService.ts
 *
 * Manages payout structure entries for a huddle. The commissioner defines
 * how the prize pool is split (1st place, 2nd place, special awards, etc.)
 * by replacing the full list in a single PUT. Members can view it read-only.
 */
import { eq, asc } from "drizzle-orm";
import { db } from "../db/client.js";
import { huddlePayoutEntries } from "../db/schema.js";
import { isCommissioner, HuddlesServiceError } from "./huddlesService.js";

const fail = (status: number, msg: string): never => {
  throw new HuddlesServiceError(status, msg);
};

export interface PayoutEntryInput {
  label: string;
  /** Amount in cents. */
  amount: number;
}

export async function listPayouts(huddleId: string) {
  return db
    .select()
    .from(huddlePayoutEntries)
    .where(eq(huddlePayoutEntries.huddleId, huddleId))
    .orderBy(asc(huddlePayoutEntries.sortOrder), asc(huddlePayoutEntries.createdAt));
}

/**
 * Replaces all payout entries for a huddle. Commissioner-only.
 * Validates labels (non-empty, ≤120 chars) and amounts (≥0).
 */
export async function setPayouts(
  huddleId: string,
  userId: string,
  entries: PayoutEntryInput[],
) {
  if (!(await isCommissioner(huddleId, userId))) {
    fail(403, "Only commissioners can update the payout structure");
  }

  if (entries.length > 50) {
    fail(400, "Maximum 50 payout entries");
  }

  for (const e of entries) {
    if (!e.label?.trim() || e.label.trim().length > 120) {
      fail(400, "Each label must be 1–120 characters");
    }
    if (!Number.isInteger(e.amount) || e.amount < 0) {
      fail(400, "Amount must be a non-negative integer (cents)");
    }
  }

  // Full replace: delete existing then insert new set.
  await db
    .delete(huddlePayoutEntries)
    .where(eq(huddlePayoutEntries.huddleId, huddleId));

  if (entries.length > 0) {
    await db.insert(huddlePayoutEntries).values(
      entries.map((e, i) => ({
        huddleId,
        label: e.label.trim(),
        amount: e.amount,
        sortOrder: i,
      })),
    );
  }

  return listPayouts(huddleId);
}
