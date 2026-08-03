export type ClaimStatus = "pending" | "approved" | "rejected";
export type HuddleMemberStatus = "commissioner" | "approved" | "pending";

export interface Huddle {
  id: string;
  leagueProvider: string | null;
  leagueId: string | null;
  name: string;
  inviteCode?: string;
  inviteCodeUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
  myStatus?: HuddleMemberStatus;
}

export interface UserSummary {
  id: string;
  username: string | null;
  email: string | null;
}

export interface CommissionerSummary {
  userId: string;
  addedAt: string;
  user: UserSummary;
}

export interface HuddleDetail extends Huddle {
  isCommissioner: boolean;
  commissioners: CommissionerSummary[];
}

export interface HuddleClaim {
  id: string;
  huddleId?: string;
  rosterId: number;
  status: ClaimStatus;
  message: string | null;
  userId: string;
  createdAt: string;
  decidedAt: string | null;
}

export interface HuddleClaimSummary {
  id: string;
  rosterId: number;
  status: ClaimStatus;
  message: string | null;
  createdAt: string;
  decidedAt: string | null;
  user: UserSummary | null;
}

export interface HuddleDetailResponse {
  huddle: HuddleDetail;
  claims: HuddleClaimSummary[];
  myClaim: { id: string; rosterId: number; status: ClaimStatus } | null;
}

export interface HuddleAnnouncement {
  id: string;
  huddleId: string;
  authorId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** Dues configuration set by the commissioner for the season. */
export interface DuesConfig {
  huddleId: string;
  /** Due amount in cents (e.g. 5000 = $50.00). */
  amount: number;
  season: string | null;
  note: string | null;
  updatedAt: string;
}

/** Payment record for a single roster within a huddle. */
export interface DuesPayment {
  id: string;
  huddleId: string;
  rosterId: number;
  /** Null means unpaid; non-null means paid at that timestamp. */
  paidAt: string | null;
  note: string | null;
  updatedAt: string;
}

export interface DuesResponse {
  config: DuesConfig | null;
  payments: DuesPayment[];
}

/** Countdown widget configuration set by the commissioner. */
export interface CountdownConfig {
  huddleId: string;
  title: string;
  subtitle: string | null;
  /** ISO 8601 timestamp of the target date/time. */
  targetAt: string;
  enabled: boolean;
  updatedAt: string;
}

// ── League forum ──────────────────────────────────────────────────────────────

export interface ForumTopic {
  id: string;
  huddleId: string;
  authorId: string;
  title: string;
  body: string;
  updatedAt: string;
  replyCount: number;
  createdAt: string;
}

export interface ForumReply {
  id: string;
  topicId: string;
  huddleId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

// ── Polls ──────────────────────────────────────────────────────────────────────

export type PollResultsVisibility = "always" | "after_vote" | "after_close";

export interface PollOption {
  id: string;
  label: string;
  /** Vote count, or null when results are hidden from the viewer. */
  votes: number | null;
}

export interface Poll {
  id: string;
  huddleId: string;
  topicId: string | null;
  isDashboardPoll: boolean;
  authorId: string;
  question: string;
  allowMultiple: boolean;
  allowVoteChanges: boolean;
  resultsVisibility: PollResultsVisibility;
  /** ISO 8601 timestamp, or null for a poll that never auto-closes. */
  closesAt: string | null;
  /** True once closesAt has passed. Voting is locked once closed. */
  isClosed: boolean;
  createdAt: string;
  options: PollOption[];
  /** Distinct voters, or null when results are hidden from the viewer. */
  totalVoters: number | null;
  /** Option IDs the current user has voted for. */
  myOptionIds: string[];
  hasVoted: boolean;
}

export interface NewPollInput {
  question: string;
  options: string[];
  allowMultiple: boolean;
  allowVoteChanges: boolean;
  resultsVisibility: PollResultsVisibility;
  /** ISO 8601 timestamp, or null for a poll that never auto-closes. */
  closesAt: string | null;
}

// ── Surveys ──────────────────────────────────────────────────────────────────

export type SurveyQuestionType = "short_text" | "paragraph" | "multiple_choice" | "checkboxes";

export interface SurveyOption {
  id: string;
  label: string;
}

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  required: boolean;
  /** Empty for short_text / paragraph questions. */
  options: SurveyOption[];
}

/**
 * Whether a text answer's respondent is shown alongside their answer:
 *   - "none": always shown.
 *   - "anonymous_to_league": shown to the commissioner, hidden from everyone
 *     else (i.e. once results are published).
 *   - "anonymous_to_all": always hidden, even from the commissioner.
 */
export type SurveyAnonymity = "none" | "anonymous_to_league" | "anonymous_to_all";

export interface SurveySummary {
  id: string;
  huddleId: string;
  authorId: string;
  title: string;
  description: string | null;
  closesAt: string;
  isClosed: boolean;
  resultsPublished: boolean;
  anonymity: SurveyAnonymity;
  autoPublishOnClose: boolean;
  responseCount: number;
  hasResponded: boolean;
  createdAt: string;
}

export interface SurveyAnswer {
  questionId: string;
  textValue: string | null;
  optionIds: string[];
}

export interface SurveyDetail {
  id: string;
  huddleId: string;
  authorId: string;
  title: string;
  description: string | null;
  closesAt: string;
  isClosed: boolean;
  resultsPublished: boolean;
  anonymity: SurveyAnonymity;
  autoPublishOnClose: boolean;
  createdAt: string;
  questions: SurveyQuestion[];
  /** The caller's own answers, or null if they haven't responded yet. */
  myAnswers: SurveyAnswer[] | null;
}

export interface SurveyResultsQuestion {
  questionId: string;
  prompt: string;
  type: SurveyQuestionType;
  optionCounts: { optionId: string; label: string; count: number }[];
  /** userId is null when anonymity hides the respondent from the viewer. */
  textAnswers: { userId: string | null; textValue: string }[];
}

export interface SurveyResults {
  surveyId: string;
  totalResponses: number;
  questions: SurveyResultsQuestion[];
}

export interface NewSurveyQuestionInput {
  /** Set when editing an existing question, so the server can preserve its
   * already-collected answers instead of treating it as a new question. */
  id?: string;
  type: SurveyQuestionType;
  prompt: string;
  required: boolean;
  /** Choice labels — only used for multiple_choice / checkboxes. */
  options: string[];
}

export interface NewSurveyInput {
  title: string;
  description: string | null;
  /** ISO 8601 timestamp. Must be in the future. */
  closesAt: string;
  anonymity: SurveyAnonymity;
  /** If true, resultsPublished auto-flips to true once the survey closes. */
  autoPublishOnClose: boolean;
  questions: NewSurveyQuestionInput[];
}

export interface SurveyAnswerInput {
  questionId: string;
  textValue?: string;
  optionIds?: string[];
}

export interface HuddleAward {
  id: string;
  huddleId: string;
  rosterId: number;
  glyph: string;
  color: string;
  title: string;
  description: string | null;
  season: string | null;
  createdAt: string;
}

export interface PayoutEntry {
  id: string;
  label: string;
  /** Amount in cents. */
  amount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Map of built-in trophy type → enabled. Missing keys default to true. */
export type ActiveTrophies = Record<string, boolean>;

// ── Side bets ──────────────────────────────────────────────────────────────────

export type SideBetStatus = "pending" | "accepted" | "rejected" | "cancelled" | "settled";

export interface SideBet {
  id: string;
  huddleId: string;
  proposerId: string;
  opponentId: string;
  proposerRosterId: number | null;
  opponentRosterId: number | null;
  week: number;
  season: string;
  /** Amount in cents. 0 = bragging rights only (or a non-cash prize). */
  amount: number;
  /** Free-text prize description when the wager isn't cash. Null for cash bets. */
  prizeDescription: string | null;
  status: SideBetStatus;
  winnerId: string | null;
  settlementNote: string | null;
  createdAt: string;
  updatedAt: string;
}
