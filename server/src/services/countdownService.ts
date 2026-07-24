/**
 * Countdown widget service.
 *
 * Commissioners configure a single countdown (title, subtitle, target date)
 * shown on the dashboard, e.g. counting down to draft night. One row per huddle.
 */
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  huddleCountdownConfig,
  type HuddleCountdownConfig,
} from "../db/schema.js";
import { HuddlesServiceError, isCommissioner } from "./huddlesService.js";

const fail = (status: number, message: string): never => {
  throw new HuddlesServiceError(status, message);
};

const MAX_TITLE_LEN = 60;
const MAX_SUBTITLE_LEN = 120;

// ---- Queries ----

/** Returns the current countdown config for a huddle, or null if none is set. */
export async function getCountdownConfig(
  huddleId: string,
): Promise<HuddleCountdownConfig | null> {
  const rows = await db
    .select()
    .from(huddleCountdownConfig)
    .where(eq(huddleCountdownConfig.huddleId, huddleId))
    .limit(1);
  return rows[0] ?? null;
}

// ---- Mutations ----

/**
 * Upsert the countdown config for a huddle. Commissioner-only.
 * `targetAt` is an ISO 8601 timestamp string.
 */
export async function setCountdownConfig(
  huddleId: string,
  userId: string,
  opts: {
    title: string;
    subtitle?: string | null;
    targetAt: string;
    enabled: boolean;
  },
): Promise<HuddleCountdownConfig> {
  if (!(await isCommissioner(huddleId, userId)))
    fail(403, "Only a commissioner can set the countdown");

  const title = opts.title.trim();
  if (!title || title.length > MAX_TITLE_LEN)
    fail(400, `title is required (max ${MAX_TITLE_LEN} chars)`);

  const subtitle = opts.subtitle?.trim() || null;
  if (subtitle && subtitle.length > MAX_SUBTITLE_LEN)
    fail(400, `subtitle must be at most ${MAX_SUBTITLE_LEN} chars`);

  const targetAt = new Date(opts.targetAt);
  if (isNaN(targetAt.getTime())) fail(400, "targetAt must be a valid date");

  const [row] = await db
    .insert(huddleCountdownConfig)
    .values({
      huddleId,
      title,
      subtitle,
      targetAt,
      enabled: opts.enabled,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: huddleCountdownConfig.huddleId,
      set: {
        title,
        subtitle,
        targetAt,
        enabled: opts.enabled,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) fail(500, "Failed to save countdown config");
  return row!;
}
