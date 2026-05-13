/**
 * trophyControlService.ts
 *
 * Lets commissioners enable/disable the built-in auto-generated trophies
 * for their league. Uses an opt-out model: if no row exists for a given
 * type, the trophy is considered enabled.
 */
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { huddleActiveTrophies } from "../db/schema.js";
import { HuddlesServiceError, isCommissioner } from "./huddlesService.js";

const fail = (status: number, message: string): never => {
  throw new HuddlesServiceError(status, message);
};

/** All built-in trophy type keys — must match what buildTrophies() emits on the client. */
export const BUILT_IN_TROPHY_TYPES = [
  "champion",
  "runner_up",
  "third",
  "high_score",
  "missed_playoffs",
] as const;

export type BuiltInTrophyType = (typeof BUILT_IN_TROPHY_TYPES)[number];

/**
 * Returns a map of trophyType → enabled for all built-in types.
 * Types with no row default to enabled=true.
 */
export async function getActiveTrophies(
  huddleId: string,
): Promise<Record<string, boolean>> {
  const rows = await db
    .select()
    .from(huddleActiveTrophies)
    .where(eq(huddleActiveTrophies.huddleId, huddleId));

  const result: Record<string, boolean> = {};
  // Default all types to enabled
  for (const t of BUILT_IN_TROPHY_TYPES) {
    result[t] = true;
  }
  // Apply saved overrides
  for (const row of rows) {
    result[row.trophyType] = row.enabled === 1;
  }
  return result;
}

/**
 * Enable or disable a built-in trophy type. Commissioner-only.
 */
export async function setTrophyEnabled(
  huddleId: string,
  userId: string,
  trophyType: string,
  enabled: boolean,
): Promise<void> {
  if (!(await isCommissioner(huddleId, userId)))
    fail(403, "Only a commissioner can control trophy visibility");

  if (!BUILT_IN_TROPHY_TYPES.includes(trophyType as BuiltInTrophyType))
    fail(400, `Unknown trophy type: ${trophyType}`);

  await db
    .insert(huddleActiveTrophies)
    .values({
      huddleId,
      trophyType,
      enabled: enabled ? 1 : 0,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [huddleActiveTrophies.huddleId, huddleActiveTrophies.trophyType],
      set: { enabled: enabled ? 1 : 0, updatedAt: new Date() },
    });
}
