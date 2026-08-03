import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const claimStatus = pgEnum("claim_status", [
  "pending",
  "approved",
  "rejected",
]);

export const huddles = pgTable(
  "huddles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leagueProvider: text("league_provider"),
    leagueId: text("league_id"),
    name: text("name").notNull(),
    inviteCode: text("invite_code").notNull(),
    inviteCodeUpdatedAt: timestamp("invite_code_updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    /** Null when no invite link is active. Regenerating overwrites both
     * columns (implicitly revoking the previous link), mirroring inviteCode. */
    inviteLinkToken: text("invite_link_token"),
    inviteLinkExpiresAt: timestamp("invite_link_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    uniqInviteCode: uniqueIndex("huddles_invite_code_uniq").on(t.inviteCode),
    uniqInviteLinkToken: uniqueIndex("huddles_invite_link_token_uniq").on(t.inviteLinkToken),
  }),
);

export const huddleCommissioners = pgTable(
  "huddle_commissioners",
  {
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    addedBy: text("added_by").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.huddleId, t.userId] }),
    byUser: index("huddle_commissioners_user_idx").on(t.userId),
  }),
);

export const teamClaims = pgTable(
  "team_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    rosterId: integer("roster_id").notNull(),
    status: claimStatus("status").notNull().default("pending"),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: text("decided_by"),
  },
  (t) => ({
    uniqApprovedRoster: uniqueIndex("team_claims_huddle_roster_approved_uniq")
      .on(t.huddleId, t.rosterId)
      .where(sql`${t.status} = 'approved'`),
    uniqApprovedUser: uniqueIndex("team_claims_huddle_user_approved_uniq")
      .on(t.huddleId, t.userId)
      .where(sql`${t.status} = 'approved'`),
    byHuddle: index("team_claims_huddle_idx").on(t.huddleId),
    byUser: index("team_claims_user_idx").on(t.userId),
  }),
);

// ── Announcements ─────────────────────────────────────────────────────────────

export const huddleAnnouncements = pgTable(
  "huddle_announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    byHuddle: index("huddle_announcements_huddle_idx").on(t.huddleId),
  }),
);

// ── Dues tracker ──────────────────────────────────────────────────────────────

export const huddleDuesConfig = pgTable("huddle_dues_config", {
  huddleId: uuid("huddle_id")
    .primaryKey()
    .references(() => huddles.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  season: text("season"),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const huddleDuesPayments = pgTable(
  "huddle_dues_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    rosterId: integer("roster_id").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    markedBy: text("marked_by").notNull(),
    note: text("note"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    uniqRoster: uniqueIndex("huddle_dues_payments_huddle_roster_uniq").on(
      t.huddleId,
      t.rosterId,
    ),
  }),
);

export type Huddle = typeof huddles.$inferSelect;
export type NewHuddle = typeof huddles.$inferInsert;
export type HuddleCommissioner = typeof huddleCommissioners.$inferSelect;
export type TeamClaim = typeof teamClaims.$inferSelect;
export type NewTeamClaim = typeof teamClaims.$inferInsert;
export type HuddleAnnouncement = typeof huddleAnnouncements.$inferSelect;
export type NewHuddleAnnouncement = typeof huddleAnnouncements.$inferInsert;
export type HuddleDuesConfig = typeof huddleDuesConfig.$inferSelect;
export type HuddleDuesPayment = typeof huddleDuesPayments.$inferSelect;

// ── Custom awards ─────────────────────────────────────────────────────────────

export const huddleAwards = pgTable(
  "huddle_awards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    rosterId: integer("roster_id").notNull(),
    glyph: text("glyph").notNull(),
    color: text("color").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    grantedBy: text("granted_by").notNull(),
    season: text("season"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    byHuddle: index("huddle_awards_huddle_idx").on(t.huddleId),
    byHuddleRoster: index("huddle_awards_huddle_roster_idx").on(t.huddleId, t.rosterId),
  }),
);

export type HuddleAward = typeof huddleAwards.$inferSelect;
export type NewHuddleAward = typeof huddleAwards.$inferInsert;

// ── Payout structure ──────────────────────────────────────────────────────────

export const huddlePayoutEntries = pgTable(
  "huddle_payout_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    amount: integer("amount").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    byHuddle: index("huddle_payout_entries_huddle_idx").on(t.huddleId),
  }),
);

export type HuddlePayoutEntry = typeof huddlePayoutEntries.$inferSelect;
export type NewHuddlePayoutEntry = typeof huddlePayoutEntries.$inferInsert;

// ── Active trophy control ─────────────────────────────────────────────────────
// Commissioners choose which built-in auto-trophies are shown for their league.
// A row exists for each type the commissioner has explicitly toggled; if no row
// exists, the trophy is considered enabled (opt-out model, not opt-in).

export const huddleActiveTrophies = pgTable(
  "huddle_active_trophies",
  {
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    /** Built-in trophy type key, e.g. "champion", "high_score". */
    trophyType: text("trophy_type").notNull(),
    enabled: integer("enabled").notNull().default(1), // 1 = on, 0 = off
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.huddleId, t.trophyType] }),
  }),
);

export type HuddleActiveTrophy = typeof huddleActiveTrophies.$inferSelect;

// ── Side bets ──────────────────────────────────────────────────────────────────
// League members propose bets against each other, tied to a specific week.
// The lifecycle is: pending → accepted/rejected, then accepted → settled/cancelled.

export const sideBetStatus = pgEnum("side_bet_status", [
  "pending",    // proposed, awaiting opponent response
  "accepted",   // both parties agreed
  "rejected",   // opponent declined
  "cancelled",  // withdrawn by either party after acceptance (or by proposer before)
  "settled",    // winner determined
]);

export const sideBets = pgTable(
  "side_bets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    proposerId: text("proposer_id").notNull(),
    opponentId: text("opponent_id").notNull(),
    proposerRosterId: integer("proposer_roster_id"),
    opponentRosterId: integer("opponent_roster_id"),
    week: integer("week").notNull(),
    season: text("season").notNull(),
    /** Amount in cents. 0 means no monetary stake (bragging rights, or a non-cash prize). */
    amount: integer("amount").notNull().default(0),
    /** Free-text prize description when the wager isn't cash (e.g. "loser buys dinner"). Null for cash bets. */
    prizeDescription: text("prize_description"),
    status: sideBetStatus("status").notNull().default("pending"),
    /** Clerk userId of the winner. Null until settled. */
    winnerId: text("winner_id"),
    settlementNote: text("settlement_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    byHuddle: index("side_bets_huddle_idx").on(t.huddleId),
    byProposer: index("side_bets_proposer_idx").on(t.huddleId, t.proposerId),
    byOpponent: index("side_bets_opponent_idx").on(t.huddleId, t.opponentId),
  }),
);

export type SideBet = typeof sideBets.$inferSelect;
export type NewSideBet = typeof sideBets.$inferInsert;

// ── Countdown widget ─────────────────────────────────────────────────────────
// Commissioner-configured countdown shown on the dashboard, e.g. counting down
// to draft night or the trade deadline. One row per huddle.

export const huddleCountdownConfig = pgTable("huddle_countdown_config", {
  huddleId: uuid("huddle_id")
    .primaryKey()
    .references(() => huddles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  targetAt: timestamp("target_at", { withTimezone: true }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type HuddleCountdownConfig = typeof huddleCountdownConfig.$inferSelect;

// ── League forum ──────────────────────────────────────────────────────────────
// Message-board style discussion, scoped to a huddle (persists across seasons).
// A topic is its own opening post; replies are separate rows underneath it.
// Deletes are soft (deletedAt/deletedBy) so pagination stays stable and
// moderation leaves an audit trail.

export const huddleForumTopics = pgTable(
  "huddle_forum_topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** Bumped whenever a reply is posted, for "recent activity" sort. */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** Denormalized count so the topic list doesn't need a join per row. */
    replyCount: integer("reply_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by"),
  },
  (t) => ({
    byHuddleActivity: index("huddle_forum_topics_huddle_updated_idx").on(
      t.huddleId,
      t.updatedAt,
    ),
  }),
);

export const huddleForumReplies = pgTable(
  "huddle_forum_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => huddleForumTopics.id, { onDelete: "cascade" }),
    /** Denormalized from the topic so replies can be queried/indexed directly. */
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by"),
  },
  (t) => ({
    byTopic: index("huddle_forum_replies_topic_idx").on(t.topicId, t.createdAt),
  }),
);

export type HuddleForumTopic = typeof huddleForumTopics.$inferSelect;
export type HuddleForumReply = typeof huddleForumReplies.$inferSelect;

// ── Polls ─────────────────────────────────────────────────────────────────────
// Two contexts share the same tables: a poll attached to a forum topic
// (topicId set) started by any approved member, or a commissioner-controlled
// poll shown on the dashboard (isDashboardPoll true, topicId null). At most
// one dashboard poll is active per huddle at a time — creating a new one
// demotes the previous one (see pollService.setDashboardPoll); demoted polls
// keep their rows/votes, they just stop showing on the dashboard.

export const pollResultsVisibility = pgEnum("poll_results_visibility", [
  "always", // results visible to everyone, even before voting
  "after_vote", // results hidden until you cast a vote
  "after_close", // results hidden until the poll's closesAt has passed
]);

export const huddlePolls = pgTable(
  "huddle_polls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    topicId: uuid("topic_id").references(() => huddleForumTopics.id, { onDelete: "cascade" }),
    isDashboardPoll: boolean("is_dashboard_poll").notNull().default(false),
    question: text("question").notNull(),
    allowMultiple: boolean("allow_multiple").notNull().default(false),
    allowVoteChanges: boolean("allow_vote_changes").notNull().default(true),
    resultsVisibility: pollResultsVisibility("results_visibility").notNull().default("always"),
    /** Voting closes once this passes. Null means the poll never auto-closes. */
    closesAt: timestamp("closes_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    byTopic: index("huddle_polls_topic_idx").on(t.topicId),
    // Enforces "at most one active dashboard poll per huddle" at the DB level.
    uniqActiveDashboardPoll: uniqueIndex("huddle_polls_dashboard_active_uniq")
      .on(t.huddleId)
      .where(sql`${t.isDashboardPoll} = true`),
  }),
);

export const huddlePollOptions = pgTable(
  "huddle_poll_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => huddlePolls.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    byPoll: index("huddle_poll_options_poll_idx").on(t.pollId),
  }),
);

export const huddlePollVotes = pgTable(
  "huddle_poll_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => huddlePolls.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => huddlePollOptions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    byPollUser: index("huddle_poll_votes_poll_user_idx").on(t.pollId, t.userId),
    uniqOptionVote: uniqueIndex("huddle_poll_votes_option_user_uniq").on(t.optionId, t.userId),
  }),
);

export type HuddlePoll = typeof huddlePolls.$inferSelect;
export type HuddlePollOption = typeof huddlePollOptions.$inferSelect;
export type HuddlePollVote = typeof huddlePollVotes.$inferSelect;

// ── Surveys ───────────────────────────────────────────────────────────────────
// A commissioner-authored, multi-question form (short/long text or
// single/multi-select), scoped to a huddle. Modeled as "a poll with several
// questions": huddleSurveyOptions plays the role of huddlePollOptions, and
// huddleSurveyAnswerOptions plays the role of huddlePollVotes (one row per
// selected option). Text-type answers live in the separate huddleSurveyAnswers
// table since they don't reference an option row.
//
// Each member gets at most one huddleSurveyResponses row per survey; editing
// a response deletes and reinserts its answers (see surveyService.submitResponse),
// mirroring pollService.castVote. Editing is only allowed before closesAt.

export const surveyQuestionType = pgEnum("survey_question_type", [
  "short_text",
  "paragraph",
  "multiple_choice",
  "checkboxes",
]);

/**
 * Controls whether a text answer's respondent is attached when results are
 * read — see surveyService.getResults for where this is enforced:
 *   - "none": always attributed.
 *   - "anonymous_to_league": attributed for the commissioner, stripped for
 *     everyone else (i.e. once results are published).
 *   - "anonymous_to_all": always stripped, even for the commissioner.
 */
export const surveyAnonymity = pgEnum("survey_anonymity", [
  "none",
  "anonymous_to_league",
  "anonymous_to_all",
]);

export const huddleSurveys = pgTable(
  "huddle_surveys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** Responses can no longer be submitted or edited once this passes. */
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    /** Commissioner-controlled: whether members can see aggregated results. */
    resultsPublished: boolean("results_published").notNull().default(false),
    /** If true, resultsPublished is flipped to true the first time the survey is read after closesAt passes. */
    autoPublishOnClose: boolean("auto_publish_on_close").notNull().default(false),
    anonymity: surveyAnonymity("anonymity").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    byHuddleActivity: index("huddle_surveys_huddle_created_idx").on(t.huddleId, t.createdAt),
  }),
);

export const huddleSurveyQuestions = pgTable(
  "huddle_survey_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => huddleSurveys.id, { onDelete: "cascade" }),
    type: surveyQuestionType("type").notNull(),
    prompt: text("prompt").notNull(),
    required: boolean("required").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    bySurvey: index("huddle_survey_questions_survey_idx").on(t.surveyId, t.sortOrder),
  }),
);

/** Choices for multiple_choice / checkboxes questions. */
export const huddleSurveyOptions = pgTable(
  "huddle_survey_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => huddleSurveyQuestions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    byQuestion: index("huddle_survey_options_question_idx").on(t.questionId),
  }),
);

export const huddleSurveyResponses = pgTable(
  "huddle_survey_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => huddleSurveys.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    uniqSurveyUser: uniqueIndex("huddle_survey_responses_survey_user_uniq").on(
      t.surveyId,
      t.userId,
    ),
  }),
);

/** short_text / paragraph answers — one row per question per response. */
export const huddleSurveyAnswers = pgTable(
  "huddle_survey_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    responseId: uuid("response_id")
      .notNull()
      .references(() => huddleSurveyResponses.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => huddleSurveyQuestions.id, { onDelete: "cascade" }),
    textValue: text("text_value").notNull(),
  },
  (t) => ({
    byResponse: index("huddle_survey_answers_response_idx").on(t.responseId),
    byQuestion: index("huddle_survey_answers_question_idx").on(t.questionId),
  }),
);

/** multiple_choice / checkboxes answers — one row per selected option. */
export const huddleSurveyAnswerOptions = pgTable(
  "huddle_survey_answer_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    responseId: uuid("response_id")
      .notNull()
      .references(() => huddleSurveyResponses.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => huddleSurveyQuestions.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => huddleSurveyOptions.id, { onDelete: "cascade" }),
  },
  (t) => ({
    byQuestion: index("huddle_survey_answer_options_question_idx").on(t.questionId),
    uniqResponseOption: uniqueIndex("huddle_survey_answer_options_response_option_uniq").on(
      t.responseId,
      t.optionId,
    ),
  }),
);

export type HuddleSurvey = typeof huddleSurveys.$inferSelect;
export type HuddleSurveyQuestion = typeof huddleSurveyQuestions.$inferSelect;
export type HuddleSurveyOption = typeof huddleSurveyOptions.$inferSelect;
export type HuddleSurveyResponse = typeof huddleSurveyResponses.$inferSelect;
export type HuddleSurveyAnswer = typeof huddleSurveyAnswers.$inferSelect;
export type HuddleSurveyAnswerOption = typeof huddleSurveyAnswerOptions.$inferSelect;
