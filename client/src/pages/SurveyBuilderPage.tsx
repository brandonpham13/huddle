/**
 * SurveyBuilderPage — Google Forms-style survey builder, shared by create
 * and edit.
 *
 * Routes: /league/surveys/new (create) and /league/surveys/:surveyId/edit
 * (edit — prefills from the existing survey via useSurvey).
 *
 * Commissioner-only. Title + description + a required closing date, plus a
 * dynamic list of questions (short answer, paragraph, multiple choice,
 * checkboxes) each with its own required toggle and — for choice types —
 * an editable option list, mirroring PollComposer's add/remove pattern.
 *
 * Editing replaces the entire question set (see surveyService.updateSurvey)
 * — like Google Forms, removing/changing a question drops any answers
 * already collected for it.
 */
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ClipboardList, Plus, Trash2, X } from "lucide-react";
import { useSelectedLeagueHuddle, useHuddleDetail } from "../hooks/useHuddles";
import { useSurvey, useCreateSurvey, useUpdateSurvey } from "../hooks/useSurveys";
import { Panel, PanelHeader, Btn } from "./ForumPage";
import { toDatetimeLocalValue } from "../utils/datetime";
import type { SurveyQuestionType, NewSurveyQuestionInput, SurveyAnonymity } from "../types/huddle";

const ANONYMITY_OPTIONS: { value: SurveyAnonymity; label: string; note: string }[] = [
  {
    value: "none",
    label: "Not anonymous",
    note: "Respondent names are visible to you and, once published, to the league.",
  },
  {
    value: "anonymous_to_league",
    label: "Anonymous to the league",
    note: "You can see who answered what; published results hide names from the rest of the league.",
  },
  {
    value: "anonymous_to_all",
    label: "Anonymous to everyone",
    note: "Nobody — including you — can see who answered what, even in your own results view.",
  },
];

const QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  short_text: "Short answer",
  paragraph: "Paragraph",
  multiple_choice: "Multiple choice",
  checkboxes: "Checkboxes",
};

const CHOICE_TYPES = new Set<SurveyQuestionType>(["multiple_choice", "checkboxes"]);
const MAX_OPTIONS = 10;

interface DraftQuestion extends NewSurveyQuestionInput {
  key: string;
}

function blankQuestion(): DraftQuestion {
  return {
    key: crypto.randomUUID(),
    type: "short_text",
    prompt: "",
    required: true,
    options: ["", ""],
  };
}

function QuestionCard({
  question,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  question: DraftQuestion;
  index: number;
  canRemove: boolean;
  onChange: (next: DraftQuestion) => void;
  onRemove: () => void;
}) {
  function setType(type: SurveyQuestionType) {
    onChange({ ...question, type, options: CHOICE_TYPES.has(type) && question.options.length >= 2
      ? question.options
      : ["", ""] });
  }

  function setOption(i: number, label: string) {
    const options = [...question.options];
    options[i] = label;
    onChange({ ...question, options });
  }

  function addOption() {
    if (question.options.length >= MAX_OPTIONS) return;
    onChange({ ...question, options: [...question.options, ""] });
  }

  function removeOption(i: number) {
    if (question.options.length <= 2) return;
    onChange({ ...question, options: question.options.filter((_, j) => j !== i) });
  }

  return (
    <div className="border border-line rounded-lg p-4 flex flex-col gap-3 bg-paper">
      <div className="flex items-start gap-2">
        <span className="text-[11px] font-mono text-muted pt-2 shrink-0">{index + 1}.</span>
        <input
          type="text"
          value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
          placeholder="Question"
          maxLength={300}
          required
          className="flex-1 border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
        />
        <select
          value={question.type}
          onChange={(e) => setType(e.target.value as SurveyQuestionType)}
          className="border border-line rounded-md px-2 py-1.5 text-xs bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30 shrink-0"
        >
          {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-muted hover:text-red-600 transition-colors p-1.5"
            aria-label="Remove question"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {CHOICE_TYPES.has(question.type) && (
        <div className="pl-6 flex flex-col gap-1.5">
          {question.options.map((option, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted w-3 shrink-0">
                {question.type === "multiple_choice" ? "○" : "☐"}
              </span>
              <input
                type="text"
                value={option}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                maxLength={150}
                required
                className="flex-1 border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
              />
              {question.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="shrink-0 text-muted hover:text-red-600 transition-colors p-1"
                  aria-label={`Remove option ${i + 1}`}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {question.options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={addOption}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-ink transition-colors w-fit"
            >
              <Plus size={12} />
              Add option
            </button>
          )}
        </div>
      )}

      <label className="pl-6 flex items-center gap-2 text-[12px] text-ink">
        <input
          type="checkbox"
          checked={question.required}
          onChange={(e) => onChange({ ...question, required: e.target.checked })}
          className="accent-ink"
        />
        Required
      </label>
    </div>
  );
}

export function SurveyBuilderPage() {
  const { surveyId } = useParams<{ surveyId?: string }>();
  const isEdit = !!surveyId;
  const navigate = useNavigate();
  const huddle = useSelectedLeagueHuddle();
  const huddleId = huddle?.id ?? null;
  const { data: huddleDetail } = useHuddleDetail(huddleId);
  const isCommissioner = huddleDetail?.huddle?.isCommissioner ?? false;

  const { data: existingSurvey, isLoading: isLoadingSurvey } = useSurvey(
    huddleId,
    isEdit ? (surveyId ?? null) : null,
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [anonymity, setAnonymity] = useState<SurveyAnonymity>("none");
  const [autoPublishOnClose, setAutoPublishOnClose] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([blankQuestion()]);
  const [error, setError] = useState<string | null>(null);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  const createSurvey = useCreateSurvey();
  const updateSurvey = useUpdateSurvey();
  const saving = createSurvey.isPending || updateSurvey.isPending;

  // Prefill from the existing survey exactly once when editing, so a
  // background refetch doesn't clobber in-progress edits.
  useEffect(() => {
    if (!isEdit || !existingSurvey || initializedFor === existingSurvey.id) return;
    setTitle(existingSurvey.title);
    setDescription(existingSurvey.description ?? "");
    setClosesAt(toDatetimeLocalValue(existingSurvey.closesAt));
    setAnonymity(existingSurvey.anonymity);
    setAutoPublishOnClose(existingSurvey.autoPublishOnClose);
    setQuestions(
      existingSurvey.questions.map((q) => ({
        key: q.id,
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        required: q.required,
        options: q.options.length > 0 ? q.options.map((o) => o.label) : ["", ""],
      })),
    );
    setInitializedFor(existingSurvey.id);
  }, [isEdit, existingSurvey, initializedFor]);

  if (huddleDetail && !isCommissioner) return <Navigate to="/league/surveys" replace />;
  if (!huddleId) return <Navigate to="/league/surveys" replace />;
  if (isEdit && !isLoadingSurvey && !existingSurvey) return <Navigate to="/league/surveys" replace />;

  function updateQuestion(key: string, next: DraftQuestion) {
    setQuestions((qs) => qs.map((q) => (q.key === key ? next : q)));
  }

  function removeQuestion(key: string) {
    setQuestions((qs) => qs.filter((q) => q.key !== key));
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, blankQuestion()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!closesAt) {
      setError("Set a closing date for the survey.");
      return;
    }
    if (!isEdit && new Date(closesAt).getTime() <= Date.now()) {
      setError("The closing date must be in the future.");
      return;
    }
    for (const q of questions) {
      if (!q.prompt.trim()) {
        setError("Every question needs a prompt.");
        return;
      }
      if (CHOICE_TYPES.has(q.type) && q.options.filter((o) => o.trim()).length < 2) {
        setError(`"${q.prompt.trim()}" needs at least 2 options.`);
        return;
      }
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      closesAt: new Date(closesAt).toISOString(),
      anonymity,
      autoPublishOnClose,
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt.trim(),
        required: q.required,
        options: CHOICE_TYPES.has(q.type) ? q.options.map((o) => o.trim()).filter(Boolean) : [],
      })),
    };

    try {
      if (isEdit && surveyId) {
        await updateSurvey.mutateAsync({ huddleId: huddleId!, surveyId, survey: payload });
        navigate(`/league/surveys/${surveyId}`);
      } else {
        const survey = await createSurvey.mutateAsync({ huddleId: huddleId!, survey: payload });
        navigate(`/league/surveys/${survey.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? "save" : "create"} survey.`);
    }
  }

  const cancelTo = isEdit && surveyId ? `/league/surveys/${surveyId}` : "/league/surveys";

  if (isEdit && isLoadingSurvey) {
    return <div className="p-6 max-w-2xl text-sm text-muted font-sans">Loading…</div>;
  }

  return (
    <div className="p-6 max-w-2xl flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <ClipboardList size={18} className="text-muted shrink-0" />
        <h1 className="font-serif font-semibold text-xl text-ink">{isEdit ? "Edit Survey" : "New Survey"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Panel>
          <PanelHeader title="Details" description="What are you asking the league?" />
          <div className="flex flex-col gap-3 font-sans text-sm">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2026 Season Preferences"
                maxLength={150}
                required
                className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add any context for the league…"
                rows={2}
                maxLength={2000}
                className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30 resize-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Closes
              </label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                required
                className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30 w-fit"
              />
              <p className="text-[11px] text-muted font-sans">
                Responses can be submitted or changed until this date.
              </p>
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-ink">
              <input
                type="checkbox"
                checked={autoPublishOnClose}
                onChange={(e) => setAutoPublishOnClose(e.target.checked)}
                className="accent-ink"
              />
              Automatically publish results to the league once the survey closes
            </label>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Response anonymity
              </label>
              <div className="flex flex-col gap-1.5">
                {ANONYMITY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-2 px-3 py-1.5 border border-line rounded-md cursor-pointer hover:bg-highlight transition-colors"
                  >
                    <input
                      type="radio"
                      name="survey-anonymity"
                      checked={anonymity === opt.value}
                      onChange={() => setAnonymity(opt.value)}
                      className="accent-ink shrink-0 mt-0.5"
                    />
                    <span className="flex flex-col">
                      <span className="text-ink text-[13px] font-medium">{opt.label}</span>
                      <span className="text-muted text-[11px] font-sans">{opt.note}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <div className="flex flex-col gap-3">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.key}
              question={q}
              index={i}
              canRemove={questions.length > 1}
              onChange={(next) => updateQuestion(q.key, next)}
              onRemove={() => removeQuestion(q.key)}
            />
          ))}
          <button
            type="button"
            onClick={addQuestion}
            className="inline-flex items-center gap-1.5 text-xs font-medium font-sans text-muted hover:text-ink transition-colors w-fit"
          >
            <Plus size={13} />
            Add question
          </button>
        </div>

        {error && <p className="text-red-600 text-xs font-sans">{error}</p>}

        <div className="flex gap-2">
          <Btn variant="primary" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Survey"}
          </Btn>
          <Btn onClick={() => navigate(cancelTo)}>Cancel</Btn>
        </div>
      </form>
    </div>
  );
}
