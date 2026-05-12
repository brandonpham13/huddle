/**
 * Dues Tracker service.
 *
 * Commissioners set a dues amount (in cents) for the season and mark each
 * roster as paid or unpaid. Members can view their own status; commissioners
 * see the full league-wide view. All filtering is done on the client so this
 * layer just returns everything.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  huddleDuesConfig,
  huddleDuesPayments,
  type HuddleDuesConfig,
  type HuddleDuesPayment,
} from "../db/schema.js";
import { HuddlesServiceError, isCommissioner } from "./huddlesService.js";

const fail = (status: number, message: string): never => {
  throw new HuddlesServiceError(status, message);
};

// ---- Queries ----

/** Returns the current dues config for a huddle, or null if none is set. */
export async function getDuesConfig(
  huddleId: string,
): Promise<HuddleDuesConfig | null> {
  const rows = await db
    .select()
    .from(huddleDuesConfig)
    .where(eq(huddleDuesConfig.huddleId, huddleId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Returns all payment records for a huddle.
 * A roster without a row here is considered unpaid.
 */
export async function getDuesPayments(
  huddleId: string,
): Promise<HuddleDuesPayment[]> {
  return db
    .select()
    .from(huddleDuesPayments)
    .where(eq(huddleDuesPayments.huddleId, huddleId));
}

// ---- Mutations ----

/**
 * Upsert the dues config for a huddle. Commissioner-only.
 * `amount` is in cents; `season` and `note` are optional.
 */
export async function setDuesConfig(
  huddleId: string,
  userId: string,
  opts: { amount: number; season?: string | null; note?: string | null },
): Promise<HuddleDuesConfig> {
  if (!(await isCommissioner(huddleId, userId)))
    fail(403, "Only a commissioner can set dues");

  if (!Number.isInteger(opts.amount) || opts.amount < 0)
    fail(400, "amount must be a non-negative integer (cents)");

  const [row] = await db
    .insert(huddleDuesConfig)
    .values({
      huddleId,
      amount: opts.amount,
      season: opts.season ?? null,
      note: opts.note ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: huddleDuesConfig.huddleId,
      set: {
        amount: opts.amount,
        season: opts.season ?? null,
        note: opts.note ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) fail(500, "Failed to save dues config");
  return row!;
}

/**
 * Mark a roster as paid or unpaid. Commissioner-only.
 * Upserts a payment record; `paidAt` is set to now when paid, or null when unpaid.
 */
export async function setDuesPaid(
  huddleId: string,
  userId: string,
  rosterId: number,
  paid: boolean,
  note?: string | null,
): Promise<HuddleDuesPayment> {
  if (!(await isCommissioner(huddleId, userId)))
    fail(403, "Only a commissioner can mark dues as paid");

  if (!Number.isInteger(rosterId) || rosterId < 1)
    fail(400, "rosterId must be a positive integer");

  const paidAt = paid ? new Date() : null;

  const [row] = await db
    .insert(huddleDuesPayments)
    .values({
      huddleId,
      rosterId,
      paidAt,
      markedBy: userId,
      note: note ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [huddleDuesPayments.huddleId, huddleDuesPayments.rosterId],
      set: {
        paidAt,
        markedBy: userId,
        note: note ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) fail(500, "Failed to update payment record");
  return row!;
}
