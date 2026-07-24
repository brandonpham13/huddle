/**
 * Poll service.
 *
 * Two contexts share these tables: a poll attached to a forum topic (any
 * approved member, created alongside the topic), or a commissioner-controlled
 * poll shown on the dashboard (at most one active per huddle at a time — see
 * `setDashboardPoll`). Voting requires an approved team claim, same gate as
 * forum posting.
 */
import { and, asc, count, countDistinct, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  huddlePolls,
  huddlePollOptions,
  huddlePollVotes,
  type HuddlePoll,
} from "../db/schema.js";
import { HuddlesServiceError, isCommissioner, hasApprovedClaim } from "./huddlesService.js";

const fail = (status: number, message: string): never => {
  throw new HuddlesServiceError(status, message);
};

const MAX_QUESTION_LEN = 200;
const MAX_OPTION_LEN = 100;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

export type ResultsVisibility = "always" | "after_vote" | "after_close";

export interface NewPollInput {
  question: string;
  options: string[];
  allowMultiple: boolean;
  allowVoteChanges: boolean;
  resultsVisibility: ResultsVisibility;
  /** ISO 8601 timestamp, or null for a poll that never auto-closes. */
  closesAt: string | null;
}

export interface PollWithResults {
  id: string;
  huddleId: string;
  topicId: string | null;
  isDashboardPoll: boolean;
  authorId: string;
  question: string;
  allowMultiple: boolean;
  allowVoteChanges: boolean;
  resultsVisibility: ResultsVisibility;
  closesAt: Date | null;
  /** True once closesAt has passed. Voting is locked once closed. */
  isClosed: boolean;
  createdAt: Date;
  options: { id: string; label: string; votes: number | null }[];
  /** Distinct voters. Null when results are hidden from this viewer. */
  totalVoters: number | null;
  /** Option IDs the requesting user has voted for. */
  myOptionIds: string[];
  hasVoted: boolean;
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function getPollWithResults(
  pollId: string,
  userId: string,
): Promise<PollWithResults | null> {
  const [poll] = await db.select().from(huddlePolls).where(eq(huddlePolls.id, pollId)).limit(1);
  if (!poll) return null;

  const optionRows = await db
    .select()
    .from(huddlePollOptions)
    .where(eq(huddlePollOptions.pollId, pollId))
    .orderBy(asc(huddlePollOptions.sortOrder));

  const myVoteRows = await db
    .select()
    .from(huddlePollVotes)
    .where(and(eq(huddlePollVotes.pollId, pollId), eq(huddlePollVotes.userId, userId)));
  const myOptionIds = myVoteRows.map((v) => v.optionId);
  const hasVoted = myOptionIds.length > 0;

  const isClosed = poll.closesAt !== null && poll.closesAt.getTime() <= Date.now();

  const resultsVisible =
    poll.resultsVisibility === "always" ||
    (poll.resultsVisibility === "after_vote" && hasVoted) ||
    (poll.resultsVisibility === "after_close" && isClosed);

  let voteCounts = new Map<string, number>();
  let totalVoters = 0;
  if (resultsVisible) {
    const countRows = await db
      .select({ optionId: huddlePollVotes.optionId, n: count() })
      .from(huddlePollVotes)
      .where(eq(huddlePollVotes.pollId, pollId))
      .groupBy(huddlePollVotes.optionId);
    voteCounts = new Map(countRows.map((r) => [r.optionId, Number(r.n)]));

    const [totalRow] = await db
      .select({ n: countDistinct(huddlePollVotes.userId) })
      .from(huddlePollVotes)
      .where(eq(huddlePollVotes.pollId, pollId));
    totalVoters = Number(totalRow?.n ?? 0);
  }

  return {
    id: poll.id,
    huddleId: poll.huddleId,
    topicId: poll.topicId,
    isDashboardPoll: poll.isDashboardPoll,
    authorId: poll.authorId,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    allowVoteChanges: poll.allowVoteChanges,
    resultsVisibility: poll.resultsVisibility,
    closesAt: poll.closesAt,
    isClosed,
    createdAt: poll.createdAt,
    options: optionRows.map((o) => ({
      id: o.id,
      label: o.label,
      votes: resultsVisible ? (voteCounts.get(o.id) ?? 0) : null,
    })),
    totalVoters: resultsVisible ? totalVoters : null,
    myOptionIds,
    hasVoted,
  };
}

/** The poll attached to a forum topic, if any. */
export async function getPollForTopic(
  huddleId: string,
  topicId: string,
  userId: string,
): Promise<PollWithResults | null> {
  const [poll] = await db
    .select()
    .from(huddlePolls)
    .where(and(eq(huddlePolls.huddleId, huddleId), eq(huddlePolls.topicId, topicId)))
    .limit(1);
  if (!poll) return null;
  return getPollWithResults(poll.id, userId);
}

/** Lightweight lookup for the poll ID attached to a topic, without loading results. */
export async function getPollIdForTopic(huddleId: string, topicId: string): Promise<string | null> {
  const [poll] = await db
    .select({ id: huddlePolls.id })
    .from(huddlePolls)
    .where(and(eq(huddlePolls.huddleId, huddleId), eq(huddlePolls.topicId, topicId)))
    .limit(1);
  return poll?.id ?? null;
}

/** The huddle's current active dashboard poll, if any. */
export async function getDashboardPoll(
  huddleId: string,
  userId: string,
): Promise<PollWithResults | null> {
  const [poll] = await db
    .select()
    .from(huddlePolls)
    .where(and(eq(huddlePolls.huddleId, huddleId), eq(huddlePolls.isDashboardPoll, true)))
    .limit(1);
  if (!poll) return null;
  return getPollWithResults(poll.id, userId);
}

// ── Mutations ──────────────────────────────────────────────────────────────────

function validateNewPoll(
  input: NewPollInput,
): { question: string; options: string[]; closesAt: Date | null } {
  const question = input.question.trim();
  if (!question || question.length > MAX_QUESTION_LEN)
    fail(400, `question is required (max ${MAX_QUESTION_LEN} chars)`);

  const options = input.options.map((o) => o.trim()).filter(Boolean);
  if (options.length < MIN_OPTIONS) fail(400, `a poll needs at least ${MIN_OPTIONS} options`);
  if (options.length > MAX_OPTIONS) fail(400, `a poll can have at most ${MAX_OPTIONS} options`);
  if (options.some((o) => o.length > MAX_OPTION_LEN))
    fail(400, `each option is limited to ${MAX_OPTION_LEN} chars`);

  let closesAt: Date | null = null;
  if (input.closesAt) {
    closesAt = new Date(input.closesAt);
    if (isNaN(closesAt.getTime())) fail(400, "closesAt must be a valid date");
  }

  if (input.resultsVisibility === "after_close" && !closesAt)
    fail(400, "an end date is required to show results after the poll closes");

  return { question, options, closesAt };
}

/** Creates a poll (and its options). Used for both forum-attached and
 * dashboard polls — callers set `topicId`/`isDashboardPoll` accordingly. */
export async function createPoll(opts: {
  huddleId: string;
  authorId: string;
  topicId?: string | null;
  isDashboardPoll?: boolean;
  question: string;
  options: string[];
  allowMultiple: boolean;
  allowVoteChanges: boolean;
  resultsVisibility: ResultsVisibility;
  closesAt: string | null;
}): Promise<PollWithResults> {
  const { question, options, closesAt } = validateNewPoll(opts);

  const [pollRow] = await db
    .insert(huddlePolls)
    .values({
      huddleId: opts.huddleId,
      authorId: opts.authorId,
      topicId: opts.topicId ?? null,
      isDashboardPoll: opts.isDashboardPoll ?? false,
      question,
      allowMultiple: opts.allowMultiple,
      allowVoteChanges: opts.allowVoteChanges,
      resultsVisibility: opts.resultsVisibility,
      closesAt,
    })
    .returning();
  if (!pollRow) fail(500, "Failed to create poll");

  await db
    .insert(huddlePollOptions)
    .values(options.map((label, i) => ({ pollId: pollRow!.id, label, sortOrder: i })));

  const result = await getPollWithResults(pollRow!.id, opts.authorId);
  if (!result) return fail(500, "Failed to load created poll");
  return result;
}

/** Commissioner: replace the huddle's active dashboard poll. The previous
 * one (if any) is demoted, not deleted — its rows/votes are kept. */
export async function setDashboardPoll(
  huddleId: string,
  userId: string,
  input: NewPollInput,
): Promise<PollWithResults> {
  if (!(await isCommissioner(huddleId, userId)))
    fail(403, "Only a commissioner can set the dashboard poll");

  await db
    .update(huddlePolls)
    .set({ isDashboardPoll: false })
    .where(and(eq(huddlePolls.huddleId, huddleId), eq(huddlePolls.isDashboardPoll, true)));

  return createPoll({
    huddleId,
    authorId: userId,
    topicId: null,
    isDashboardPoll: true,
    ...input,
  });
}

export async function castVote(opts: {
  huddleId: string;
  pollId: string;
  userId: string;
  optionIds: string[];
}): Promise<PollWithResults> {
  if (!(await hasApprovedClaim(opts.huddleId, opts.userId)))
    fail(403, "Only approved members can vote");

  const [poll] = await db
    .select()
    .from(huddlePolls)
    .where(and(eq(huddlePolls.id, opts.pollId), eq(huddlePolls.huddleId, opts.huddleId)))
    .limit(1);
  if (!poll) return fail(404, "Poll not found");
  if (poll.closesAt && poll.closesAt.getTime() <= Date.now())
    fail(409, "Voting has closed on this poll");

  const optionIds = [...new Set(opts.optionIds)];
  if (optionIds.length === 0) fail(400, "Select at least one option");
  if (!poll.allowMultiple && optionIds.length > 1)
    fail(400, "This poll only allows a single selection");

  const validOptions = await db
    .select()
    .from(huddlePollOptions)
    .where(and(eq(huddlePollOptions.pollId, opts.pollId), inArray(huddlePollOptions.id, optionIds)));
  if (validOptions.length !== optionIds.length) fail(400, "One or more options are invalid");

  const existingVotes = await db
    .select()
    .from(huddlePollVotes)
    .where(and(eq(huddlePollVotes.pollId, opts.pollId), eq(huddlePollVotes.userId, opts.userId)));
  if (existingVotes.length > 0 && !poll.allowVoteChanges)
    fail(409, "You've already voted on this poll");

  if (existingVotes.length > 0) {
    await db
      .delete(huddlePollVotes)
      .where(and(eq(huddlePollVotes.pollId, opts.pollId), eq(huddlePollVotes.userId, opts.userId)));
  }

  await db
    .insert(huddlePollVotes)
    .values(optionIds.map((optionId) => ({ pollId: opts.pollId, optionId, userId: opts.userId })));

  const result = await getPollWithResults(opts.pollId, opts.userId);
  if (!result) return fail(500, "Failed to load poll after voting");
  return result;
}

export type { HuddlePoll };
