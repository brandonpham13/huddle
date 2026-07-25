/**
 * League forum service.
 *
 * Message-board style discussion scoped to a huddle: members start topics,
 * other members reply. Posting requires an approved team claim in the huddle.
 * Deletes are soft (deletedAt/deletedBy) — a reply's author or a commissioner
 * can remove a reply; a topic can be removed by a commissioner at any time,
 * or by its author only while it has no replies yet.
 */
import { and, asc, desc, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  huddleForumTopics,
  huddleForumReplies,
  type HuddleForumTopic,
  type HuddleForumReply,
} from "../db/schema.js";
import { HuddlesServiceError, isCommissioner, hasApprovedClaim } from "./huddlesService.js";
import { createPoll, type NewPollInput } from "./pollService.js";

const fail = (status: number, message: string): never => {
  throw new HuddlesServiceError(status, message);
};

const MAX_TITLE_LEN = 120;
const MAX_BODY_LEN = 4000;
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;

// ── Queries ────────────────────────────────────────────────────────────────────

/** Topics for a huddle, most recently active first. `before` pages further back. */
export async function listTopics(
  huddleId: string,
  opts: { limit?: number; before?: string } = {},
): Promise<HuddleForumTopic[]> {
  const limit = Math.min(opts.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const conditions = [eq(huddleForumTopics.huddleId, huddleId), isNull(huddleForumTopics.deletedAt)];
  if (opts.before) conditions.push(lt(huddleForumTopics.updatedAt, new Date(opts.before)));

  return db
    .select()
    .from(huddleForumTopics)
    .where(and(...conditions))
    .orderBy(desc(huddleForumTopics.updatedAt))
    .limit(limit);
}

/** A single topic, or null if missing/deleted. */
export async function getTopic(
  huddleId: string,
  topicId: string,
): Promise<HuddleForumTopic | null> {
  const rows = await db
    .select()
    .from(huddleForumTopics)
    .where(
      and(
        eq(huddleForumTopics.id, topicId),
        eq(huddleForumTopics.huddleId, huddleId),
        isNull(huddleForumTopics.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Replies for a topic, oldest first. `after` pages further forward. */
export async function listReplies(
  huddleId: string,
  topicId: string,
  opts: { limit?: number; after?: string } = {},
): Promise<HuddleForumReply[]> {
  const limit = Math.min(opts.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const conditions = [
    eq(huddleForumReplies.topicId, topicId),
    eq(huddleForumReplies.huddleId, huddleId),
    isNull(huddleForumReplies.deletedAt),
  ];
  if (opts.after) conditions.push(gt(huddleForumReplies.createdAt, new Date(opts.after)));

  return db
    .select()
    .from(huddleForumReplies)
    .where(and(...conditions))
    .orderBy(asc(huddleForumReplies.createdAt))
    .limit(limit);
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export async function createTopic(opts: {
  huddleId: string;
  userId: string;
  title: string;
  body: string;
  poll?: NewPollInput;
}): Promise<HuddleForumTopic> {
  if (!(await hasApprovedClaim(opts.huddleId, opts.userId)))
    fail(403, "Only approved members can post to the forum");

  const title = opts.title.trim();
  if (!title || title.length > MAX_TITLE_LEN)
    fail(400, `title is required (max ${MAX_TITLE_LEN} chars)`);

  const body = opts.body.trim();
  if (!body || body.length > MAX_BODY_LEN)
    fail(400, `body is required (max ${MAX_BODY_LEN} chars)`);

  const [row] = await db
    .insert(huddleForumTopics)
    .values({
      huddleId: opts.huddleId,
      authorId: opts.userId,
      title,
      body,
    })
    .returning();

  if (!row) fail(500, "Failed to create topic");

  if (opts.poll) {
    await createPoll({
      huddleId: opts.huddleId,
      authorId: opts.userId,
      topicId: row!.id,
      isDashboardPoll: false,
      ...opts.poll,
    });
  }

  return row!;
}

export async function createReply(opts: {
  huddleId: string;
  topicId: string;
  userId: string;
  body: string;
}): Promise<HuddleForumReply> {
  if (!(await hasApprovedClaim(opts.huddleId, opts.userId)))
    fail(403, "Only approved members can post to the forum");

  const topic = await getTopic(opts.huddleId, opts.topicId);
  if (!topic) return fail(404, "Topic not found");

  const body = opts.body.trim();
  if (!body || body.length > MAX_BODY_LEN)
    fail(400, `body is required (max ${MAX_BODY_LEN} chars)`);

  const [row] = await db
    .insert(huddleForumReplies)
    .values({
      topicId: opts.topicId,
      huddleId: opts.huddleId,
      authorId: opts.userId,
      body,
    })
    .returning();

  if (!row) fail(500, "Failed to post reply");

  await db
    .update(huddleForumTopics)
    .set({ updatedAt: new Date(), replyCount: topic.replyCount + 1 })
    .where(eq(huddleForumTopics.id, opts.topicId));

  return row!;
}

export async function deleteTopic(opts: {
  huddleId: string;
  topicId: string;
  userId: string;
}): Promise<void> {
  const topic = await getTopic(opts.huddleId, opts.topicId);
  if (!topic) return fail(404, "Topic not found");

  const commish = await isCommissioner(opts.huddleId, opts.userId);
  const isAuthor = topic.authorId === opts.userId;

  if (!commish && !(isAuthor && topic.replyCount === 0))
    fail(
      403,
      "Only a commissioner can remove a topic with replies; the author can remove it before anyone replies",
    );

  await db
    .update(huddleForumTopics)
    .set({ deletedAt: new Date(), deletedBy: opts.userId })
    .where(eq(huddleForumTopics.id, opts.topicId));
}

export async function deleteReply(opts: {
  huddleId: string;
  topicId: string;
  replyId: string;
  userId: string;
}): Promise<void> {
  const rows = await db
    .select()
    .from(huddleForumReplies)
    .where(
      and(
        eq(huddleForumReplies.id, opts.replyId),
        eq(huddleForumReplies.topicId, opts.topicId),
        eq(huddleForumReplies.huddleId, opts.huddleId),
        isNull(huddleForumReplies.deletedAt),
      ),
    )
    .limit(1);
  const reply = rows[0];
  if (!reply) fail(404, "Reply not found");

  const commish = await isCommissioner(opts.huddleId, opts.userId);
  if (reply.authorId !== opts.userId && !commish)
    fail(403, "Only the author or a commissioner can remove this reply");

  await db
    .update(huddleForumReplies)
    .set({ deletedAt: new Date(), deletedBy: opts.userId })
    .where(eq(huddleForumReplies.id, opts.replyId));

  const [topic] = await db
    .select()
    .from(huddleForumTopics)
    .where(eq(huddleForumTopics.id, opts.topicId))
    .limit(1);
  if (topic) {
    await db
      .update(huddleForumTopics)
      .set({ replyCount: Math.max(0, topic.replyCount - 1) })
      .where(eq(huddleForumTopics.id, opts.topicId));
  }
}
