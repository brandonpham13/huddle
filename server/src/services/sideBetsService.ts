/**
 * Side Bets service.
 *
 * League members can propose bets against each other for a given week.
 * Lifecycle: pending → accepted | rejected; accepted → settled | cancelled.
 */
import { and, eq, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { sideBets, type SideBet } from "../db/schema.js";
import { HuddlesServiceError, isCommissioner } from "./huddlesService.js";

const fail = (status: number, message: string): never => {
  throw new HuddlesServiceError(status, message);
};

// ── Queries ────────────────────────────────────────────────────────────────────

/** All bets for a huddle, optionally filtered by week. */
export async function listBets(
  huddleId: string,
  week?: number,
): Promise<SideBet[]> {
  const conditions = [eq(sideBets.huddleId, huddleId)];
  if (week !== undefined) conditions.push(eq(sideBets.week, week));
  return db
    .select()
    .from(sideBets)
    .where(and(...conditions))
    .orderBy(sideBets.createdAt);
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export async function proposeBet(opts: {
  huddleId: string;
  proposerId: string;
  opponentId: string;
  proposerRosterId?: number;
  opponentRosterId?: number;
  week: number;
  season: string;
  description: string;
  amount: number;
}): Promise<SideBet> {
  if (opts.proposerId === opts.opponentId) fail(400, "Cannot bet against yourself");
  if (!Number.isInteger(opts.amount) || opts.amount < 0)
    fail(400, "amount must be a non-negative integer (cents)");
  if (!opts.description.trim()) fail(400, "description is required");
  if (!Number.isInteger(opts.week) || opts.week < 1)
    fail(400, "week must be a positive integer");

  const [row] = await db
    .insert(sideBets)
    .values({
      huddleId: opts.huddleId,
      proposerId: opts.proposerId,
      opponentId: opts.opponentId,
      proposerRosterId: opts.proposerRosterId ?? null,
      opponentRosterId: opts.opponentRosterId ?? null,
      week: opts.week,
      season: opts.season,
      description: opts.description.trim(),
      amount: opts.amount,
      status: "pending",
    })
    .returning();
  return row!;
}

export async function respondToBet(opts: {
  huddleId: string;
  betId: string;
  userId: string;
  response: "accepted" | "rejected";
}): Promise<SideBet> {
  const [bet] = await db
    .select()
    .from(sideBets)
    .where(and(eq(sideBets.id, opts.betId), eq(sideBets.huddleId, opts.huddleId)))
    .limit(1);

  if (!bet) fail(404, "Bet not found");
  if (bet.opponentId !== opts.userId) fail(403, "Only the opponent can respond to this bet");
  if (bet.status !== "pending") fail(409, `Bet is already ${bet.status}`);

  const [updated] = await db
    .update(sideBets)
    .set({ status: opts.response, updatedAt: new Date() })
    .where(eq(sideBets.id, opts.betId))
    .returning();
  return updated!;
}

export async function cancelBet(opts: {
  huddleId: string;
  betId: string;
  userId: string;
}): Promise<SideBet> {
  const [bet] = await db
    .select()
    .from(sideBets)
    .where(and(eq(sideBets.id, opts.betId), eq(sideBets.huddleId, opts.huddleId)))
    .limit(1);

  if (!bet) fail(404, "Bet not found");

  const isParty = bet.proposerId === opts.userId || bet.opponentId === opts.userId;
  const commish = await isCommissioner(opts.huddleId, opts.userId);

  if (!isParty && !commish) fail(403, "Only a party to the bet or a commissioner can cancel it");
  if (bet.status !== "pending" && bet.status !== "accepted")
    fail(409, `Cannot cancel a bet that is ${bet.status}`);
  if (bet.status === "pending" && bet.proposerId !== opts.userId && !commish)
    fail(403, "Only the proposer (or a commissioner) can cancel a pending bet");

  const [updated] = await db
    .update(sideBets)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(sideBets.id, opts.betId))
    .returning();
  return updated!;
}

export async function settleBet(opts: {
  huddleId: string;
  betId: string;
  userId: string;
  winnerId: string;
  settlementNote?: string;
}): Promise<SideBet> {
  const [bet] = await db
    .select()
    .from(sideBets)
    .where(and(eq(sideBets.id, opts.betId), eq(sideBets.huddleId, opts.huddleId)))
    .limit(1);

  if (!bet) fail(404, "Bet not found");
  if (bet.status !== "accepted") fail(409, "Only an accepted bet can be settled");

  const isParty = bet.proposerId === opts.userId || bet.opponentId === opts.userId;
  const commish = await isCommissioner(opts.huddleId, opts.userId);
  if (!isParty && !commish) fail(403, "Only a party to the bet or a commissioner can settle it");

  if (opts.winnerId !== bet.proposerId && opts.winnerId !== bet.opponentId)
    fail(400, "winnerId must be one of the two parties");

  const [updated] = await db
    .update(sideBets)
    .set({
      status: "settled",
      winnerId: opts.winnerId,
      settlementNote: opts.settlementNote ?? null,
      updatedAt: new Date(),
    })
    .where(eq(sideBets.id, opts.betId))
    .returning();
  return updated!;
}
