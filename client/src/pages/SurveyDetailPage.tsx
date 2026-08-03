/**
 * SurveyDetailPage — role/state-aware survey view.
 *
 * Route: /league/surveys/:surveyId
 *
 * - Commissioner: always sees the results/manage panel (per-question
 *   breakdown, publish toggle, edit, delete) — and, while the survey is
 *   still open, the fill-out form too, so commissioners can respond like
 *   any other member.
 * - Member, survey open: the fill-out form, prefilled if editing a previous
 *   response. Resubmitting overwrites the previous answers.
 * - Member, survey closed: results if the commissioner published them,
 *   otherwise a "closed" notice.
 */
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardList, Pencil, Trash2 } from "lucide-react";
import { useAppSelector } from "../store/hooks";
import { useLeagueRosters, useLeagueUsers } from "../hooks/useSleeper";
import { useSelectedLeagueHuddle, useHuddleDetail } from "../hooks/useHuddles";
import {
  useSurvey,
  useSubmitSurveyResponse,
  useSurveyResults,
  useSetResultsPublished,
  useDeleteSurvey,
} from "../hooks/useSurveys";
import { Panel, PanelHeader, Btn, formatDateTime } from "./ForumPage";
import type { SurveyQuestion, SurveyResults, SurveyAnonymity } from "../types/huddle";

/** User-facing note explaining who can see a respondent's name, for the given viewer. */
function anonymityNote(anonymity: SurveyAnonymity, viewerIsCommissioner: boolean): string {
  if (anonymity === "anonymous_to_all")
    return "Fully anonymous — not even the commissioner can see who answered what.";
  if (anonymity === "anonymous_to_league") {
    return viewerIsCommissioner
      ? "Anonymous to the league — you can see who answered what, but the rest of the league can't."
      : "Anonymous — your name won't be shown to the league.";
  }
  return "Not anonymous — your name is visible alongside your answers.";
}

interface AnswerState {
  textValue: string;
  optionIds: string[];
}

// ── Question field (fill-out mode) ──────────────────────────────────────────

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: AnswerState;
  onChange: (next: AnswerState) => void;
}) {
  if (question.type === "short_text") {
    return (
      <input
        type="text"
        value={value.textValue}
        onChange={(e) => onChange({ ...value, textValue: e.target.value })}
        maxLength={500}
        className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
      />
    );
  }
  if (question.type === "paragraph") {
    return (
      <textarea
        value={value.textValue}
        onChange={(e) => onChange({ ...value, textValue: e.target.value })}
        rows={3}
        maxLength={4000}
        className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30 resize-none"
      />
    );
  }

  const isMulti = question.type === "checkboxes";
  function toggle(optionId: string) {
    if (isMulti) {
      const optionIds = value.optionIds.includes(optionId)
        ? value.optionIds.filter((id) => id !== optionId)
        : [...value.optionIds, optionId];
      onChange({ ...value, optionIds });
    } else {
      onChange({ ...value, optionIds: [optionId] });
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {question.options.map((option) => (
        <label
          key={option.id}
          className="flex items-center gap-2 px-3 py-1.5 border border-line rounded-md cursor-pointer hover:bg-highlight transition-colors"
        >
          <input
            type={isMulti ? "checkbox" : "radio"}
            name={`survey-q-${question.id}`}
            checked={value.optionIds.includes(option.id)}
            onChange={() => toggle(option.id)}
            className="accent-ink shrink-0"
          />
          <span className="text-ink text-[13px]">{option.label}</span>
        </label>
      ))}
    </div>
  );
}

// ── Results view (commissioner, or published-for-members) ──────────────────

function ResultsView({
  results,
  resolveName,
}: {
  results: SurveyResults;
  resolveName: (clerkId: string | null) => string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-muted font-sans">
        {results.totalResponses} {results.totalResponses === 1 ? "response" : "responses"}
      </p>
      {results.questions.map((q) => (
        <div key={q.questionId} className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-ink">{q.prompt}</p>
          {q.optionCounts.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {q.optionCounts.map((o) => {
                const pct =
                  results.totalResponses > 0 ? Math.round((o.count / results.totalResponses) * 100) : 0;
                return (
                  <div key={o.optionId} className="relative border border-line rounded-md overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-highlight"
                      style={{ width: `${pct}%` }}
                      aria-hidden="true"
                    />
                    <div className="relative flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="text-ink text-[13px]">{o.label}</span>
                      <span className="text-[11px] text-muted font-mono shrink-0">
                        {o.count} · {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : q.textAnswers.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {q.textAnswers.map((a, i) => (
                <div key={i} className="border border-line rounded-md px-3 py-1.5">
                  <p className="text-[10px] text-muted font-sans">{resolveName(a.userId)}</p>
                  <p className="text-[13px] text-ink font-sans whitespace-pre-wrap">{a.textValue}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted font-sans">No answers yet.</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function SurveyDetailPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const selectedLeagueId = useAppSelector((state) => state.auth.selectedLeagueId);
  const { user } = useUser();
  const myClerkId = user?.id ?? "";
  const navigate = useNavigate();

  const huddle = useSelectedLeagueHuddle();
  const huddleId = huddle?.id ?? null;

  const { data: huddleDetail } = useHuddleDetail(huddleId);
  const { data: rosters } = useLeagueRosters(selectedLeagueId);
  const { data: leagueUsers } = useLeagueUsers(selectedLeagueId);
  const { data: survey, isLoading } = useSurvey(huddleId, surveyId ?? null);

  const isCommissioner = huddleDetail?.huddle?.isCommissioner ?? false;
  const canRespond = isCommissioner || huddleDetail?.myClaim?.status === "approved";

  const showResults = isCommissioner || (survey?.resultsPublished ?? false);
  const { data: results } = useSurveyResults(huddleId, surveyId ?? null, showResults);

  const submitResponse = useSubmitSurveyResponse();
  const setResultsPublished = useSetResultsPublished();
  const deleteSurvey = useDeleteSurvey();

  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!huddleDetail?.claims || !rosters || !leagueUsers) return map;

    for (const claim of huddleDetail.claims) {
      if (claim.status !== "approved" || !claim.user) continue;
      const roster = rosters.find((r) => r.rosterId === claim.rosterId);
      const sleepUser = roster?.ownerId
        ? leagueUsers.find((u) => u.userId === roster.ownerId)
        : null;
      const displayName =
        sleepUser?.teamName ?? sleepUser?.displayName ?? claim.user.username ?? `Team ${claim.rosterId}`;
      map.set(claim.user.id, displayName);
    }
    return map;
  }, [huddleDetail, rosters, leagueUsers]);
  const resolveName = (clerkId: string | null) => {
    if (clerkId === null) return "Anonymous";
    return nameMap.get(clerkId) ?? (clerkId === myClerkId ? "You" : "Unknown");
  };

  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Prefill from the caller's existing answers exactly once per survey load,
  // so a background refetch doesn't clobber in-progress edits.
  useEffect(() => {
    if (!survey || initializedFor === survey.id) return;
    const initial: Record<string, AnswerState> = {};
    for (const q of survey.questions) {
      const existing = survey.myAnswers?.find((a) => a.questionId === q.id);
      initial[q.id] = { textValue: existing?.textValue ?? "", optionIds: existing?.optionIds ?? [] };
    }
    setAnswers(initial);
    setInitializedFor(survey.id);
  }, [survey, initializedFor]);

  if (!selectedLeagueId) return <Navigate to="/" replace />;
  if (!huddleId) {
    return (
      <div className="p-8 max-w-xl">
        <p className="text-sm text-muted font-sans">
          No huddle is linked to this league yet. Ask your commissioner to set one up.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setJustSubmitted(false);
    if (!survey || !surveyId) return;
    try {
      await submitResponse.mutateAsync({
        huddleId: huddleId!,
        surveyId,
        answers: survey.questions.map((q) => ({
          questionId: q.id,
          textValue: answers[q.id]?.textValue,
          optionIds: answers[q.id]?.optionIds,
        })),
      });
      setJustSubmitted(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to submit response.");
    }
  }

  async function handleTogglePublish() {
    if (!survey || !surveyId) return;
    await setResultsPublished.mutateAsync({
      huddleId: huddleId!,
      surveyId,
      resultsPublished: !survey.resultsPublished,
    });
  }

  async function handleDelete() {
    if (!surveyId) return;
    await deleteSurvey.mutateAsync({ huddleId: huddleId!, surveyId });
    navigate("/league/surveys");
  }

  return (
    <div className="p-6 max-w-2xl flex flex-col gap-4">
      <Link
        to="/league/surveys"
        className="inline-flex items-center gap-1.5 text-xs font-medium font-sans text-muted hover:text-ink transition-colors w-fit"
      >
        <ArrowLeft size={13} />
        Back to Surveys
      </Link>

      {isLoading ? (
        <p className="text-sm text-muted font-sans">Loading…</p>
      ) : !survey ? (
        <div className="py-10 text-center">
          <ClipboardList size={28} className="mx-auto text-muted mb-3" />
          <p className="text-sm text-muted font-sans">Survey not found — it may have been removed.</p>
        </div>
      ) : (
        <>
          <Panel>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-serif font-semibold text-lg text-ink leading-snug">{survey.title}</h1>
                <p className="mt-1 text-[11px] text-muted font-sans">
                  {survey.isClosed ? "Closed" : "Open"} · {survey.isClosed ? "closed" : "closes"}{" "}
                  {formatDateTime(survey.closesAt)}
                </p>
              </div>
              {isCommissioner && (
                <div className="flex items-center gap-3 shrink-0">
                  {!confirmingDelete && (
                    <button
                      onClick={() => navigate(`/league/surveys/${surveyId}/edit`)}
                      className="text-muted hover:text-ink transition-colors"
                      aria-label="Edit survey"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  {!confirmingDelete ? (
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      className="text-muted hover:text-red-600 transition-colors"
                      aria-label="Delete survey"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted font-sans">Delete survey?</span>
                      <Btn onClick={() => setConfirmingDelete(false)}>Cancel</Btn>
                      <Btn danger disabled={deleteSurvey.isPending} onClick={handleDelete}>
                        {deleteSurvey.isPending ? "Deleting…" : "Confirm"}
                      </Btn>
                    </div>
                  )}
                </div>
              )}
            </div>
            {survey.description && (
              <p className="text-[13px] text-ink font-sans leading-relaxed whitespace-pre-wrap">
                {survey.description}
              </p>
            )}
          </Panel>

          {isCommissioner && (
            <Panel>
              <PanelHeader
                title="Results"
                description={
                  survey.resultsPublished ? "Visible to the whole league." : "Only you can see this."
                }
              />
              <p className="text-[11px] text-muted font-sans -mt-2">
                {anonymityNote(survey.anonymity, true)}
              </p>
              {survey.autoPublishOnClose && !survey.resultsPublished && (
                <p className="text-[11px] text-muted font-sans -mt-2">
                  Set to auto-publish once the survey closes.
                </p>
              )}
              <div>
                <Btn onClick={handleTogglePublish} disabled={setResultsPublished.isPending}>
                  {survey.resultsPublished ? "Unpublish results" : "Publish results to league"}
                </Btn>
              </div>
              {results ? (
                <ResultsView results={results} resolveName={resolveName} />
              ) : (
                <p className="text-sm text-muted font-sans">Loading results…</p>
              )}
            </Panel>
          )}

          {!isCommissioner && survey.isClosed && (
            <Panel>
              <PanelHeader title="Results" />
              {survey.resultsPublished ? (
                results ? (
                  <ResultsView results={results} resolveName={resolveName} />
                ) : (
                  <p className="text-sm text-muted font-sans">Loading results…</p>
                )
              ) : (
                <p className="text-sm text-muted font-sans">
                  This survey has closed. Results haven't been published yet.
                </p>
              )}
            </Panel>
          )}

          {!survey.isClosed &&
            (canRespond ? (
              <Panel>
                <PanelHeader
                  title={survey.myAnswers ? "Your response" : "Respond"}
                  description="You can change your answers until the survey closes."
                />
                <p className="text-[11px] text-muted font-sans -mt-2">
                  {anonymityNote(survey.anonymity, isCommissioner)}
                </p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-sans text-sm">
                  {survey.questions.map((q) => (
                    <div key={q.id} className="flex flex-col gap-1.5">
                      <label className="text-[13px] text-ink font-medium">
                        {q.prompt}
                        {q.required && <span className="text-red-600"> *</span>}
                      </label>
                      <QuestionField
                        question={q}
                        value={answers[q.id] ?? { textValue: "", optionIds: [] }}
                        onChange={(next) => setAnswers((prev) => ({ ...prev, [q.id]: next }))}
                      />
                    </div>
                  ))}
                  {formError && <p className="text-red-600 text-xs">{formError}</p>}
                  {justSubmitted && !formError && (
                    <p className="text-accent text-xs">
                      Response recorded — you can update it until the survey closes.
                    </p>
                  )}
                  <div>
                    <Btn variant="primary" disabled={submitResponse.isPending}>
                      {submitResponse.isPending
                        ? "Saving…"
                        : survey.myAnswers
                          ? "Update response"
                          : "Submit response"}
                    </Btn>
                  </div>
                </form>
              </Panel>
            ) : (
              <p className="text-[12px] text-muted font-sans">
                Only approved league members can respond. Claim your team to join in.
              </p>
            ))}
        </>
      )}
    </div>
  );
}
