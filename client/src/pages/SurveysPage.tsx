/**
 * SurveysPage — league survey list.
 *
 * Route: /league/surveys
 *
 * Any approved member can view and fill out surveys; only commissioners can
 * create one. Creating a survey is a dedicated page, not an inline form —
 * see SurveyBuilderPage.tsx for the Google Forms-style builder (also reused
 * for editing an existing survey).
 */
import { Navigate, useNavigate } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";
import { useAppSelector } from "../store/hooks";
import { useSelectedLeagueHuddle, useHuddleDetail } from "../hooks/useHuddles";
import { useSurveys } from "../hooks/useSurveys";
import { formatDateTime } from "./ForumPage";
import type { SurveySummary } from "../types/huddle";

function SurveyRow({ survey, onClick }: { survey: SurveySummary; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-line rounded-lg p-4 bg-paper hover:bg-highlight transition-colors flex items-start justify-between gap-3"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-[13px] font-semibold text-ink leading-snug truncate">{survey.title}</p>
        <p className="text-[11px] text-muted font-sans">
          {survey.isClosed ? "Closed" : `Closes ${formatDateTime(survey.closesAt)}`}
          {" · "}
          {survey.responseCount} {survey.responseCount === 1 ? "response" : "responses"}
        </p>
      </div>
      {!survey.isClosed && (
        <span
          className={`shrink-0 text-[11px] font-sans font-medium ${
            survey.hasResponded ? "text-accent" : "text-muted"
          }`}
        >
          {survey.hasResponded ? "Responded" : "Open"}
        </span>
      )}
    </button>
  );
}

export function SurveysPage() {
  const selectedLeagueId = useAppSelector((state) => state.auth.selectedLeagueId);
  const navigate = useNavigate();

  const huddle = useSelectedLeagueHuddle();
  const huddleId = huddle?.id ?? null;

  const { data: huddleDetail } = useHuddleDetail(huddleId);
  const { data: surveys = [], isLoading } = useSurveys(huddleId);

  const isCommissioner = huddleDetail?.huddle?.isCommissioner ?? false;
  const canRespond = huddleDetail?.myClaim?.status === "approved";

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

  return (
    <div className="p-6 max-w-2xl flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-muted shrink-0" />
            <h1 className="font-serif font-semibold text-xl text-ink">Surveys</h1>
          </div>
          <p className="mt-1 text-[12.5px] text-muted font-sans">
            League surveys — commissioner-run, Google Forms-style.
          </p>
        </div>
        {isCommissioner && (
          <button
            onClick={() => navigate("/league/surveys/new")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper text-xs font-medium font-sans hover:opacity-90 transition-colors shrink-0"
          >
            <Plus size={13} />
            New Survey
          </button>
        )}
      </div>

      {!isCommissioner && !canRespond && (
        <p className="text-[12px] text-muted font-sans -mt-2">
          Only approved league members can respond to surveys. Claim your team to join in.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted font-sans">Loading surveys…</p>
      ) : surveys.length === 0 ? (
        <div className="py-10 text-center">
          <ClipboardList size={28} className="mx-auto text-muted mb-3" />
          <p className="text-sm text-muted font-sans">No surveys yet.</p>
          {isCommissioner && (
            <p className="text-xs text-muted font-sans mt-1">Hit "New Survey" to ask the league something.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {surveys.map((survey) => (
            <SurveyRow key={survey.id} survey={survey} onClick={() => navigate(`/league/surveys/${survey.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
