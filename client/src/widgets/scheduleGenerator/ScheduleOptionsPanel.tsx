/**
 * ScheduleOptionsPanel — the knobs that feed `generateSchedule()`: season
 * length, how many times the rotation is allowed to repeat
 * (matches-per-opponent), and whether rivalry weeks are in play at all. The
 * rivalry toggle lives here rather than on `LockedMatchupsPanel` itself so
 * the page can decide whether to render that panel at all — flip it off and
 * the whole rivalry section disappears rather than just going inert.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Panel, PanelHeader } from "./_shared";
import {
  MIN_SEASON_WEEKS,
  MAX_SEASON_WEEKS,
  type MatchesPerOpponent,
  type ScheduleOptions,
} from "../../utils/scheduleGenerator";

export function ScheduleOptionsPanel({
  options,
  onChange,
  rivalryWeeksEnabled,
  onRivalryWeeksEnabledChange,
}: {
  options: ScheduleOptions;
  onChange: (next: ScheduleOptions) => void;
  rivalryWeeksEnabled: boolean;
  onRivalryWeeksEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Season Settings"
        description="Controls how many weeks are generated and how opponents repeat."
      />

      <div className="flex flex-col gap-3 font-sans text-sm">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Regular season weeks
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...options, weeks: Math.max(MIN_SEASON_WEEKS, options.weeks - 1) })}
              disabled={options.weeks <= MIN_SEASON_WEEKS}
              aria-label="Fewer weeks"
              className="w-7 h-7 flex items-center justify-center rounded-md border border-line text-ink hover:bg-highlight transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="w-6 text-center font-mono text-sm text-ink tabular-nums">
              {options.weeks}
            </span>
            <button
              type="button"
              onClick={() => onChange({ ...options, weeks: Math.min(MAX_SEASON_WEEKS, options.weeks + 1) })}
              disabled={options.weeks >= MAX_SEASON_WEEKS}
              aria-label="More weeks"
              className="w-7 h-7 flex items-center justify-center rounded-md border border-line text-ink hover:bg-highlight transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Matches per opponent
          </label>
          <select
            value={options.matchesPerOpponent}
            onChange={(e) =>
              onChange({
                ...options,
                matchesPerOpponent: (e.target.value === "auto"
                  ? "auto"
                  : Number(e.target.value)) as MatchesPerOpponent,
              })
            }
            className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
          >
            <option value="auto">Auto — fill every week</option>
            <option value={1}>Once each (leave extra weeks open)</option>
            <option value={2}>Twice each (leave extra weeks open)</option>
          </select>
          <p className="text-[11px] text-muted leading-relaxed">
            "Auto" repeats the rotation (reshuffled) to fill every week. Capping it
            leaves later weeks empty so you can fill them manually.
          </p>
        </div>

        <label className="flex items-center justify-between gap-2 pt-1 border-t border-line cursor-pointer select-none">
          <span className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Enable rivalry weeks
            </span>
            <span className="text-[11px] text-muted leading-relaxed">
              Pin specific teams to face a rival in one or two shared weeks.
            </span>
          </span>
          <input
            type="checkbox"
            checked={rivalryWeeksEnabled}
            onChange={(e) => onRivalryWeeksEnabledChange(e.target.checked)}
            className="accent-ink w-4 h-4 shrink-0"
          />
        </label>
      </div>
    </Panel>
  );
}
