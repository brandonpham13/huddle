/**
 * PollComposer — controlled form for building a NewPollInput.
 *
 * Shared between ForumPage's "attach a poll" toggle on a new topic and
 * CommissionerPage's dashboard poll panel — same question/options/settings
 * shape in both places, just different submit targets.
 */
import { Plus, X } from "lucide-react";
import type { NewPollInput } from "../types/huddle";
import { toDatetimeLocalValue } from "../utils/datetime";

export const MAX_POLL_OPTIONS = 10;

export const EMPTY_POLL_INPUT: NewPollInput = {
  question: "",
  options: ["", ""],
  allowMultiple: false,
  allowVoteChanges: true,
  resultsVisibility: "always",
  closesAt: null,
};

export function PollComposer({
  value,
  onChange,
}: {
  value: NewPollInput;
  onChange: (next: NewPollInput) => void;
}) {
  function setOption(index: number, label: string) {
    const options = [...value.options];
    options[index] = label;
    onChange({ ...value, options });
  }

  function addOption() {
    if (value.options.length >= MAX_POLL_OPTIONS) return;
    onChange({ ...value, options: [...value.options, ""] });
  }

  function removeOption(index: number) {
    if (value.options.length <= 2) return;
    onChange({ ...value, options: value.options.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex flex-col gap-3 font-sans text-sm border-t border-line pt-3">
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Question</label>
        <input
          type="text"
          value={value.question}
          onChange={(e) => onChange({ ...value, question: e.target.value })}
          placeholder="e.g. Who wins this trade?"
          maxLength={200}
          required
          className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Options</label>
        <div className="flex flex-col gap-1.5">
          {value.options.map((option, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                type="text"
                value={option}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                maxLength={100}
                required
                className="flex-1 border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
              />
              {value.options.length > 2 && (
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
        </div>
        {value.options.length < MAX_POLL_OPTIONS && (
          <button
            type="button"
            onClick={addOption}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-ink transition-colors w-fit"
          >
            <Plus size={12} />
            Add option
          </button>
        )}
      </div>

      <label className="flex items-center gap-2 text-[12.5px] text-ink">
        <input
          type="checkbox"
          checked={value.allowMultiple}
          onChange={(e) => onChange({ ...value, allowMultiple: e.target.checked })}
          className="accent-ink"
        />
        Allow selecting multiple options
      </label>

      <label className="flex items-center gap-2 text-[12.5px] text-ink">
        <input
          type="checkbox"
          checked={value.allowVoteChanges}
          onChange={(e) => onChange({ ...value, allowVoteChanges: e.target.checked })}
          className="accent-ink"
        />
        Allow changing your vote
      </label>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          End date (optional)
        </label>
        <input
          type="datetime-local"
          value={value.closesAt ? toDatetimeLocalValue(value.closesAt) : ""}
          onChange={(e) =>
            onChange({
              ...value,
              closesAt: e.target.value ? new Date(e.target.value).toISOString() : null,
            })
          }
          className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30 w-fit"
        />
        <p className="text-[11px] text-muted font-sans">
          Voting locks once this passes. Leave blank for a poll that stays open.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Show results
        </label>
        <select
          value={value.resultsVisibility}
          onChange={(e) => {
            const resultsVisibility =
              e.target.value === "after_vote" || e.target.value === "after_close"
                ? e.target.value
                : "always";
            onChange({ ...value, resultsVisibility });
          }}
          className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30 w-fit"
        >
          <option value="always">Always visible</option>
          <option value="after_vote">Hidden until you vote</option>
          <option value="after_close">Hidden until the poll closes</option>
        </select>
        {value.resultsVisibility === "after_close" && !value.closesAt && (
          <p className="text-[11px] text-red-600 font-sans">Set an end date above for this option.</p>
        )}
      </div>
    </div>
  );
}
