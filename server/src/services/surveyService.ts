/**
 * Survey service — commissioner-authored, multi-question forms scoped to a
 * huddle. Modeled as "a poll with several questions": see the schema comment
 * on `huddleSurveys` in `db/schema.ts` for how the tables map onto the poll
 * tables this mirrors.
 *
 * Only commissioners can create/publish-results/delete a survey. Any approved
 * member can submit a response, and can resubmit (overwriting their previous
 * answers) any time before `closesAt`. Results are visible to commissioners
 * always, and to members only once the commissioner publishes them.
 */
import { and, asc, desc, eq, inArray, count } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  huddleSurveys,
  huddleSurveyQuestions,
  huddleSurveyOptions,
  huddleSurveyResponses,
  huddleSurveyAnswers,
  huddleSurveyAnswerOptions,
  type HuddleSurvey,
} from "../db/schema.js";
import { HuddlesServiceError, isCommissioner, hasApprovedClaim } from "./huddlesService.js";

const fail = (status: number, message: string): never => {
  throw new HuddlesServiceError(status, message);
};

const MAX_TITLE_LEN = 150;
const MAX_DESCRIPTION_LEN = 2000;
const MAX_PROMPT_LEN = 300;
const MAX_OPTION_LEN = 150;
const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 30;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

export type SurveyQuestionType = "short_text" | "paragraph" | "multiple_choice" | "checkboxes";
const CHOICE_TYPES = new Set<SurveyQuestionType>(["multiple_choice", "checkboxes"]);

/**
 * Whether a text answer's respondent is attached when results are read:
 *   - "none": always attributed.
 *   - "anonymous_to_league": attributed for the commissioner, stripped for
 *     everyone else.
 *   - "anonymous_to_all": always stripped, even for the commissioner.
 */
export type SurveyAnonymity = "none" | "anonymous_to_league" | "anonymous_to_all";
const ANONYMITY_VALUES = new Set<SurveyAnonymity>(["none", "anonymous_to_league", "anonymous_to_all"]);

export interface NewSurveyQuestionInput {
  /** Set when editing an existing question — lets updateSurvey preserve its
   * id (and thus its already-collected answers) instead of replacing it. */
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

export interface SurveyOptionData {
  id: string;
  label: string;
}

export interface SurveyQuestionData {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  required: boolean;
  options: SurveyOptionData[];
}

export interface SurveyAnswerData {
  questionId: string;
  textValue: string | null;
  optionIds: string[];
}

export interface SurveySummary {
  id: string;
  huddleId: string;
  authorId: string;
  title: string;
  description: string | null;
  closesAt: Date;
  isClosed: boolean;
  resultsPublished: boolean;
  anonymity: SurveyAnonymity;
  autoPublishOnClose: boolean;
  responseCount: number;
  hasResponded: boolean;
  createdAt: Date;
}

export interface SurveyDetail {
  id: string;
  huddleId: string;
  authorId: string;
  title: string;
  description: string | null;
  closesAt: Date;
  isClosed: boolean;
  resultsPublished: boolean;
  anonymity: SurveyAnonymity;
  autoPublishOnClose: boolean;
  createdAt: Date;
  questions: SurveyQuestionData[];
  /** The caller's own answers, or null if they haven't responded yet. */
  myAnswers: SurveyAnswerData[] | null;
}

export interface SurveyResultsQuestion {
  questionId: string;
  prompt: string;
  type: SurveyQuestionType;
  optionCounts: { optionId: string; label: string; count: number }[];
  /** userId is null when anonymity hides the respondent from this viewer. */
  textAnswers: { userId: string | null; textValue: string }[];
}

export interface SurveyResults {
  surveyId: string;
  totalResponses: number;
  questions: SurveyResultsQuestion[];
}

function isClosed(survey: Pick<HuddleSurvey, "closesAt">): boolean {
  return survey.closesAt.getTime() <= Date.now();
}

/**
 * Lazily flips resultsPublished to true for any closed survey that has
 * autoPublishOnClose set but hasn't been marked published yet. There's no
 * background job in this app (serverless, no cron) — instead every read
 * path self-heals the flag the first time it notices the survey has closed.
 */
async function applyAutoPublish(surveys: HuddleSurvey[]): Promise<HuddleSurvey[]> {
  const now = Date.now();
  const toPublish = surveys.filter(
    (s) => !s.resultsPublished && s.autoPublishOnClose && s.closesAt.getTime() <= now,
  );
  if (toPublish.length === 0) return surveys;

  const ids = toPublish.map((s) => s.id);
  await db.update(huddleSurveys).set({ resultsPublished: true }).where(inArray(huddleSurveys.id, ids));

  const publishedIds = new Set(ids);
  return surveys.map((s) => (publishedIds.has(s.id) ? { ...s, resultsPublished: true } : s));
}

// ── Queries ────────────────────────────────────────────────────────────────────

/** Surveys for a huddle, newest first. */
export async function listSurveys(huddleId: string, userId: string): Promise<SurveySummary[]> {
  const rawSurveys = await db
    .select()
    .from(huddleSurveys)
    .where(eq(huddleSurveys.huddleId, huddleId))
    .orderBy(desc(huddleSurveys.createdAt));
  if (rawSurveys.length === 0) return [];

  const surveys = await applyAutoPublish(rawSurveys);
  const ids = surveys.map((s) => s.id);

  const countRows = await db
    .select({ surveyId: huddleSurveyResponses.surveyId, n: count() })
    .from(huddleSurveyResponses)
    .where(inArray(huddleSurveyResponses.surveyId, ids))
    .groupBy(huddleSurveyResponses.surveyId);
  const countBySurvey = new Map(countRows.map((r) => [r.surveyId, Number(r.n)]));

  const myResponseRows = await db
    .select({ surveyId: huddleSurveyResponses.surveyId })
    .from(huddleSurveyResponses)
    .where(and(inArray(huddleSurveyResponses.surveyId, ids), eq(huddleSurveyResponses.userId, userId)));
  const respondedSurveyIds = new Set(myResponseRows.map((r) => r.surveyId));

  return surveys.map((s) => ({
    id: s.id,
    huddleId: s.huddleId,
    authorId: s.authorId,
    title: s.title,
    description: s.description,
    closesAt: s.closesAt,
    isClosed: isClosed(s),
    resultsPublished: s.resultsPublished,
    anonymity: s.anonymity,
    autoPublishOnClose: s.autoPublishOnClose,
    responseCount: countBySurvey.get(s.id) ?? 0,
    hasResponded: respondedSurveyIds.has(s.id),
    createdAt: s.createdAt,
  }));
}

async function getSurveyRow(huddleId: string, surveyId: string): Promise<HuddleSurvey | null> {
  const rows = await db
    .select()
    .from(huddleSurveys)
    .where(and(eq(huddleSurveys.id, surveyId), eq(huddleSurveys.huddleId, huddleId)))
    .limit(1);
  const survey = rows[0] ?? null;
  if (!survey) return null;
  const [published] = await applyAutoPublish([survey]);
  return published!;
}

async function getQuestionsWithOptions(surveyId: string): Promise<SurveyQuestionData[]> {
  const questionRows = await db
    .select()
    .from(huddleSurveyQuestions)
    .where(eq(huddleSurveyQuestions.surveyId, surveyId))
    .orderBy(asc(huddleSurveyQuestions.sortOrder));
  if (questionRows.length === 0) return [];

  const questionIds = questionRows.map((q) => q.id);
  const optionRows = await db
    .select()
    .from(huddleSurveyOptions)
    .where(inArray(huddleSurveyOptions.questionId, questionIds))
    .orderBy(asc(huddleSurveyOptions.sortOrder));

  const optionsByQuestion = new Map<string, SurveyOptionData[]>();
  for (const o of optionRows) {
    const list = optionsByQuestion.get(o.questionId) ?? [];
    list.push({ id: o.id, label: o.label });
    optionsByQuestion.set(o.questionId, list);
  }

  return questionRows.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    required: q.required,
    options: optionsByQuestion.get(q.id) ?? [],
  }));
}

async function getMyAnswers(surveyId: string, userId: string): Promise<SurveyAnswerData[] | null> {
  const [response] = await db
    .select()
    .from(huddleSurveyResponses)
    .where(and(eq(huddleSurveyResponses.surveyId, surveyId), eq(huddleSurveyResponses.userId, userId)))
    .limit(1);
  if (!response) return null;

  const textRows = await db
    .select()
    .from(huddleSurveyAnswers)
    .where(eq(huddleSurveyAnswers.responseId, response.id));
  const optionRows = await db
    .select()
    .from(huddleSurveyAnswerOptions)
    .where(eq(huddleSurveyAnswerOptions.responseId, response.id));

  const optionIdsByQuestion = new Map<string, string[]>();
  for (const o of optionRows) {
    const list = optionIdsByQuestion.get(o.questionId) ?? [];
    list.push(o.optionId);
    optionIdsByQuestion.set(o.questionId, list);
  }

  const answers: SurveyAnswerData[] = textRows.map((t) => ({
    questionId: t.questionId,
    textValue: t.textValue,
    optionIds: [],
  }));
  for (const [questionId, optionIds] of optionIdsByQuestion) {
    answers.push({ questionId, textValue: null, optionIds });
  }
  return answers;
}

/** Survey + questions/options + the caller's own answers, for filling out or reviewing. */
export async function getSurveyForFill(
  huddleId: string,
  surveyId: string,
  userId: string,
): Promise<SurveyDetail | null> {
  const survey = await getSurveyRow(huddleId, surveyId);
  if (!survey) return null;

  const [questions, myAnswers] = await Promise.all([
    getQuestionsWithOptions(survey.id),
    getMyAnswers(survey.id, userId),
  ]);

  return {
    id: survey.id,
    huddleId: survey.huddleId,
    authorId: survey.authorId,
    title: survey.title,
    description: survey.description,
    closesAt: survey.closesAt,
    isClosed: isClosed(survey),
    resultsPublished: survey.resultsPublished,
    anonymity: survey.anonymity,
    autoPublishOnClose: survey.autoPublishOnClose,
    createdAt: survey.createdAt,
    questions,
    myAnswers,
  };
}

/** Aggregated results — only for commissioners, or members once published. */
export async function getResults(
  huddleId: string,
  surveyId: string,
  userId: string,
): Promise<SurveyResults> {
  const survey = await getSurveyRow(huddleId, surveyId);
  if (!survey) return fail(404, "Survey not found");

  const commish = await isCommissioner(huddleId, userId);
  if (!commish) {
    if (!survey.resultsPublished || !(await hasApprovedClaim(huddleId, userId)))
      fail(403, "Results aren't available yet");
  }

  const hideIdentity =
    survey.anonymity === "anonymous_to_all" || (survey.anonymity === "anonymous_to_league" && !commish);

  const questions = await getQuestionsWithOptions(survey.id);

  const [totalRow] = await db
    .select({ n: count() })
    .from(huddleSurveyResponses)
    .where(eq(huddleSurveyResponses.surveyId, survey.id));
  const totalResponses = Number(totalRow?.n ?? 0);

  const results: SurveyResultsQuestion[] = [];
  for (const q of questions) {
    if (CHOICE_TYPES.has(q.type)) {
      const countRows = await db
        .select({ optionId: huddleSurveyAnswerOptions.optionId, n: count() })
        .from(huddleSurveyAnswerOptions)
        .where(eq(huddleSurveyAnswerOptions.questionId, q.id))
        .groupBy(huddleSurveyAnswerOptions.optionId);
      const countByOption = new Map(countRows.map((r) => [r.optionId, Number(r.n)]));
      results.push({
        questionId: q.id,
        prompt: q.prompt,
        type: q.type,
        optionCounts: q.options.map((o) => ({
          optionId: o.id,
          label: o.label,
          count: countByOption.get(o.id) ?? 0,
        })),
        textAnswers: [],
      });
    } else {
      const rows = await db
        .select({ userId: huddleSurveyResponses.userId, textValue: huddleSurveyAnswers.textValue })
        .from(huddleSurveyAnswers)
        .innerJoin(huddleSurveyResponses, eq(huddleSurveyAnswers.responseId, huddleSurveyResponses.id))
        .where(eq(huddleSurveyAnswers.questionId, q.id));
      results.push({
        questionId: q.id,
        prompt: q.prompt,
        type: q.type,
        optionCounts: [],
        textAnswers: rows.map((r) => ({
          userId: hideIdentity ? null : r.userId,
          textValue: r.textValue,
        })),
      });
    }
  }

  return { surveyId: survey.id, totalResponses, questions: results };
}

// ── Mutations ──────────────────────────────────────────────────────────────────

function validateNewSurvey(
  input: NewSurveyInput,
  opts: { requireFutureClose: boolean },
): {
  title: string;
  description: string | null;
  closesAt: Date;
  anonymity: SurveyAnonymity;
  autoPublishOnClose: boolean;
  questions: ValidatedQuestion[];
} {
  const title = input.title.trim();
  if (!title || title.length > MAX_TITLE_LEN)
    fail(400, `title is required (max ${MAX_TITLE_LEN} chars)`);

  const description = input.description?.trim() || null;
  if (description && description.length > MAX_DESCRIPTION_LEN)
    fail(400, `description is limited to ${MAX_DESCRIPTION_LEN} chars`);

  const closesAt = new Date(input.closesAt);
  if (isNaN(closesAt.getTime())) fail(400, "closesAt must be a valid date");
  if (opts.requireFutureClose && closesAt.getTime() <= Date.now())
    fail(400, "closesAt must be in the future");

  if (!ANONYMITY_VALUES.has(input.anonymity)) fail(400, `invalid anonymity: ${input.anonymity}`);

  if (input.questions.length < MIN_QUESTIONS || input.questions.length > MAX_QUESTIONS)
    fail(400, `a survey needs between ${MIN_QUESTIONS} and ${MAX_QUESTIONS} questions`);

  const questions = input.questions.map((q) => {
    const prompt = q.prompt.trim();
    if (!prompt || prompt.length > MAX_PROMPT_LEN)
      fail(400, `each question prompt is required (max ${MAX_PROMPT_LEN} chars)`);

    if (!CHOICE_TYPES.has(q.type) && q.type !== "short_text" && q.type !== "paragraph")
      fail(400, `invalid question type: ${q.type}`);

    let options: string[] = [];
    if (CHOICE_TYPES.has(q.type)) {
      options = (q.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (options.length < MIN_OPTIONS) fail(400, `"${prompt}" needs at least ${MIN_OPTIONS} options`);
      if (options.length > MAX_OPTIONS) fail(400, `"${prompt}" can have at most ${MAX_OPTIONS} options`);
      if (options.some((o) => o.length > MAX_OPTION_LEN))
        fail(400, `each option is limited to ${MAX_OPTION_LEN} chars`);
    }

    return { id: q.id, type: q.type, prompt, required: q.required, options };
  });

  return {
    title,
    description,
    closesAt,
    anonymity: input.anonymity,
    autoPublishOnClose: input.autoPublishOnClose,
    questions,
  };
}

type ValidatedQuestion = {
  /** Present only when this question already existed (i.e. an edit, not a new question). */
  id?: string;
  type: SurveyQuestionType;
  prompt: string;
  required: boolean;
  options: string[];
};

/** Inserts a brand-new question set — used for survey creation, where nothing exists yet. */
async function insertQuestions(surveyId: string, questions: ValidatedQuestion[]): Promise<void> {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    const [questionRow] = await db
      .insert(huddleSurveyQuestions)
      .values({ surveyId, type: q.type, prompt: q.prompt, required: q.required, sortOrder: i })
      .returning();
    if (!questionRow) fail(500, "Failed to save question");

    if (q.options.length > 0) {
      await db
        .insert(huddleSurveyOptions)
        .values(q.options.map((label, j) => ({ questionId: questionRow!.id, label, sortOrder: j })));
    }
  }
}

/**
 * Reconciles a choice question's options by label: a label that already
 * exists keeps its row (and thus its collected votes), a new label gets a
 * fresh row, and an existing label no longer present is deleted (dropping
 * only the votes for that specific option, via FK cascade on huddleSurveyAnswerOptions).
 */
async function syncQuestionOptions(
  questionId: string,
  existingOptions: SurveyOptionData[],
  incomingLabels: string[],
): Promise<void> {
  const existingByLabel = new Map(existingOptions.map((o) => [o.label, o.id]));
  const keepLabels = new Set(incomingLabels);

  const removeIds = existingOptions.filter((o) => !keepLabels.has(o.label)).map((o) => o.id);
  if (removeIds.length > 0) {
    await db.delete(huddleSurveyOptions).where(inArray(huddleSurveyOptions.id, removeIds));
  }

  for (let j = 0; j < incomingLabels.length; j++) {
    const label = incomingLabels[j]!;
    const existingId = existingByLabel.get(label);
    if (existingId) {
      await db.update(huddleSurveyOptions).set({ sortOrder: j }).where(eq(huddleSurveyOptions.id, existingId));
    } else {
      await db.insert(huddleSurveyOptions).values({ questionId, label, sortOrder: j });
    }
  }
}

export async function createSurvey(opts: {
  huddleId: string;
  userId: string;
  input: NewSurveyInput;
}): Promise<SurveyDetail> {
  if (!(await isCommissioner(opts.huddleId, opts.userId)))
    fail(403, "Only a commissioner can create a survey");

  const { title, description, closesAt, anonymity, autoPublishOnClose, questions } = validateNewSurvey(
    opts.input,
    { requireFutureClose: true },
  );

  const [surveyRow] = await db
    .insert(huddleSurveys)
    .values({
      huddleId: opts.huddleId,
      authorId: opts.userId,
      title,
      description,
      closesAt,
      anonymity,
      autoPublishOnClose,
    })
    .returning();
  if (!surveyRow) fail(500, "Failed to create survey");

  await insertQuestions(surveyRow!.id, questions);

  const result = await getSurveyForFill(opts.huddleId, surveyRow!.id, opts.userId);
  if (!result) return fail(500, "Failed to load created survey");
  return result;
}

/**
 * Replaces a survey's title/description/closesAt/anonymity/autoPublishOnClose
 * and reconciles its question set against what's submitted — like editing a
 * Google Form. Questions and options are matched by id/label (see
 * syncQuestionOptions): an unchanged question keeps its row and its
 * already-collected answers regardless of what else on the survey changed
 * (e.g. editing the anonymity setting alone no longer wipes every response).
 * Only a question that's genuinely removed, or whose type changes shape
 * (e.g. short answer -> multiple choice), loses its collected answers.
 */
export async function updateSurvey(opts: {
  huddleId: string;
  surveyId: string;
  userId: string;
  input: NewSurveyInput;
}): Promise<SurveyDetail> {
  if (!(await isCommissioner(opts.huddleId, opts.userId)))
    fail(403, "Only a commissioner can edit a survey");

  const existing = await getSurveyRow(opts.huddleId, opts.surveyId);
  if (!existing) return fail(404, "Survey not found");

  const { title, description, closesAt, anonymity, autoPublishOnClose, questions } = validateNewSurvey(
    opts.input,
    { requireFutureClose: false },
  );

  await db
    .update(huddleSurveys)
    .set({ title, description, closesAt, anonymity, autoPublishOnClose })
    .where(eq(huddleSurveys.id, opts.surveyId));

  const existingQuestions = await getQuestionsWithOptions(opts.surveyId);
  const existingById = new Map(existingQuestions.map((q) => [q.id, q]));
  const incomingIds = new Set(questions.map((q) => q.id).filter((id): id is string => !!id));

  const removedIds = existingQuestions.map((q) => q.id).filter((id) => !incomingIds.has(id));
  if (removedIds.length > 0) {
    await db.delete(huddleSurveyQuestions).where(inArray(huddleSurveyQuestions.id, removedIds));
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    const match = q.id ? existingById.get(q.id) : undefined;

    if (!match) {
      const [questionRow] = await db
        .insert(huddleSurveyQuestions)
        .values({ surveyId: opts.surveyId, type: q.type, prompt: q.prompt, required: q.required, sortOrder: i })
        .returning();
      if (!questionRow) fail(500, "Failed to save question");
      if (q.options.length > 0) {
        await db
          .insert(huddleSurveyOptions)
          .values(q.options.map((label, j) => ({ questionId: questionRow!.id, label, sortOrder: j })));
      }
      continue;
    }

    await db
      .update(huddleSurveyQuestions)
      .set({ type: q.type, prompt: q.prompt, required: q.required, sortOrder: i })
      .where(eq(huddleSurveyQuestions.id, match.id));

    if (match.type !== q.type) {
      // Shape changed — the old answers/options no longer apply to this question.
      await db.delete(huddleSurveyAnswers).where(eq(huddleSurveyAnswers.questionId, match.id));
      await db.delete(huddleSurveyAnswerOptions).where(eq(huddleSurveyAnswerOptions.questionId, match.id));
      await db.delete(huddleSurveyOptions).where(eq(huddleSurveyOptions.questionId, match.id));
      if (q.options.length > 0) {
        await db
          .insert(huddleSurveyOptions)
          .values(q.options.map((label, j) => ({ questionId: match.id, label, sortOrder: j })));
      }
    } else if (CHOICE_TYPES.has(q.type)) {
      await syncQuestionOptions(match.id, match.options, q.options);
    }
  }

  const result = await getSurveyForFill(opts.huddleId, opts.surveyId, opts.userId);
  if (!result) return fail(500, "Failed to load updated survey");
  return result;
}

export async function submitResponse(opts: {
  huddleId: string;
  surveyId: string;
  userId: string;
  answers: SurveyAnswerInput[];
}): Promise<SurveyDetail> {
  const allowed =
    (await hasApprovedClaim(opts.huddleId, opts.userId)) || (await isCommissioner(opts.huddleId, opts.userId));
  if (!allowed) fail(403, "Only approved members can respond to a survey");

  const survey = await getSurveyRow(opts.huddleId, opts.surveyId);
  if (!survey) return fail(404, "Survey not found");
  if (isClosed(survey)) fail(409, "This survey has closed");

  const questions = await getQuestionsWithOptions(survey.id);
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  const answersByQuestion = new Map(opts.answers.map((a) => [a.questionId, a]));

  for (const q of questions) {
    const answer = answersByQuestion.get(q.id);
    const validOptionIds = new Set(q.options.map((o) => o.id));

    if (CHOICE_TYPES.has(q.type)) {
      const optionIds = [...new Set(answer?.optionIds ?? [])];
      if (q.required && optionIds.length === 0) fail(400, `"${q.prompt}" requires an answer`);
      if (q.type === "multiple_choice" && optionIds.length > 1)
        fail(400, `"${q.prompt}" only allows a single selection`);
      if (optionIds.some((id) => !validOptionIds.has(id)))
        fail(400, `"${q.prompt}" has an invalid selection`);
    } else {
      const textValue = answer?.textValue?.trim() ?? "";
      if (q.required && !textValue) fail(400, `"${q.prompt}" requires an answer`);
    }
  }
  for (const questionId of answersByQuestion.keys()) {
    if (!questionsById.has(questionId)) fail(400, "Answer references an unknown question");
  }

  const [existing] = await db
    .select()
    .from(huddleSurveyResponses)
    .where(and(eq(huddleSurveyResponses.surveyId, survey.id), eq(huddleSurveyResponses.userId, opts.userId)))
    .limit(1);

  let responseId: string;
  if (existing) {
    responseId = existing.id;
    await db.delete(huddleSurveyAnswers).where(eq(huddleSurveyAnswers.responseId, responseId));
    await db.delete(huddleSurveyAnswerOptions).where(eq(huddleSurveyAnswerOptions.responseId, responseId));
    await db
      .update(huddleSurveyResponses)
      .set({ updatedAt: new Date() })
      .where(eq(huddleSurveyResponses.id, responseId));
  } else {
    const [responseRow] = await db
      .insert(huddleSurveyResponses)
      .values({ surveyId: survey.id, userId: opts.userId })
      .returning();
    if (!responseRow) return fail(500, "Failed to record response");
    responseId = responseRow.id;
  }

  for (const q of questions) {
    const answer = answersByQuestion.get(q.id);
    if (!answer) continue;

    if (CHOICE_TYPES.has(q.type)) {
      const optionIds = [...new Set(answer.optionIds ?? [])];
      if (optionIds.length > 0) {
        await db
          .insert(huddleSurveyAnswerOptions)
          .values(optionIds.map((optionId) => ({ responseId, questionId: q.id, optionId })));
      }
    } else {
      const textValue = answer.textValue?.trim() ?? "";
      if (textValue) {
        await db.insert(huddleSurveyAnswers).values({ responseId, questionId: q.id, textValue });
      }
    }
  }

  const result = await getSurveyForFill(opts.huddleId, opts.surveyId, opts.userId);
  if (!result) return fail(500, "Failed to load survey after response");
  return result;
}

export async function setResultsPublished(
  huddleId: string,
  surveyId: string,
  userId: string,
  published: boolean,
): Promise<void> {
  if (!(await isCommissioner(huddleId, userId)))
    fail(403, "Only a commissioner can publish survey results");

  const survey = await getSurveyRow(huddleId, surveyId);
  if (!survey) fail(404, "Survey not found");

  await db
    .update(huddleSurveys)
    .set({ resultsPublished: published })
    .where(eq(huddleSurveys.id, surveyId));
}

export async function deleteSurvey(huddleId: string, surveyId: string, userId: string): Promise<void> {
  if (!(await isCommissioner(huddleId, userId)))
    fail(403, "Only a commissioner can delete a survey");

  const survey = await getSurveyRow(huddleId, surveyId);
  if (!survey) fail(404, "Survey not found");

  await db.delete(huddleSurveys).where(eq(huddleSurveys.id, surveyId));
}
