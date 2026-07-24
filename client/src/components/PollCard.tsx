/**
 * PollCard — renders a poll's question, voting controls, and results.
 *
 * Shared between ForumTopicPage (poll attached to a topic) and
 * PollWidget (commissioner's dashboard poll) — voting mechanics and
 * results-visibility rules are identical, only the vote handler differs.
 */
import { useEffect, useState } from "react";
import type { Poll } from "../types/huddle";

export function PollCard({
  poll,
  onVote,
  voting,
  error,
  readOnly,
}: {
  poll: Poll;
  onVote: (optionIds: string[]) => void;
  voting: boolean;
  error?: string | null;
  /** Status-preview mode: no vote inputs/button (e.g. commissioner panel). */
  readOnly?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(poll.myOptionIds);

  // Re-sync local selection if the poll data changes underneath us (e.g.
  // after a vote round-trip, or switching to a different poll).
  useEffect(() => {
    setSelected(poll.myOptionIds);
  }, [poll.id, poll.myOptionIds.join(",")]);

  const resultsVisible = poll.totalVoters !== null;
  const locked = readOnly || (poll.hasVoted && !poll.allowVoteChanges);

  function toggleOption(optionId: string) {
    if (poll.allowMultiple) {
      setSelected((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
      );
    } else {
      setSelected([optionId]);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 font-sans text-sm">
      <p className="text-[13px] font-semibold text-ink leading-snug">{poll.question}</p>

      <div className="flex flex-col gap-1.5">
        {poll.options.map((option) => {
          const isSelected = selected.includes(option.id);
          const pct =
            resultsVisible && poll.totalVoters! > 0
              ? Math.round(((option.votes ?? 0) / poll.totalVoters!) * 100)
              : 0;

          return (
            <div key={option.id}>
              {locked || resultsVisible ? (
                <div className="relative border border-line rounded-md overflow-hidden">
                  {resultsVisible && (
                    <div
                      className="absolute inset-y-0 left-0 bg-highlight"
                      style={{ width: `${pct}%` }}
                      aria-hidden="true"
                    />
                  )}
                  <label
                    className={`relative flex items-center gap-2 px-3 py-1.5 ${locked ? "" : "cursor-pointer"}`}
                  >
                    {!locked && (
                      <input
                        type={poll.allowMultiple ? "checkbox" : "radio"}
                        name={`poll-${poll.id}`}
                        checked={isSelected}
                        onChange={() => toggleOption(option.id)}
                        className="accent-ink shrink-0"
                      />
                    )}
                    <span className="flex-1 text-ink text-[13px]">{option.label}</span>
                    {resultsVisible && (
                      <span className="text-[11px] text-muted font-mono shrink-0">
                        {option.votes} · {pct}%
                      </span>
                    )}
                  </label>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-1.5 border border-line rounded-md cursor-pointer hover:bg-highlight transition-colors">
                  <input
                    type={poll.allowMultiple ? "checkbox" : "radio"}
                    name={`poll-${poll.id}`}
                    checked={isSelected}
                    onChange={() => toggleOption(option.id)}
                    className="accent-ink shrink-0"
                  />
                  <span className="text-ink text-[13px]">{option.label}</span>
                </label>
              )}
            </div>
          );
        })}
      </div>

      {resultsVisible && (
        <p className="text-[11px] text-muted font-sans">
          {poll.totalVoters} {poll.totalVoters === 1 ? "vote" : "votes"}
        </p>
      )}

      {error && <p className="text-red-600 text-xs">{error}</p>}

      {!locked && (
        <div>
          <button
            onClick={() => onVote(selected)}
            disabled={voting || selected.length === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper text-xs font-medium font-sans transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {voting ? "Saving…" : poll.hasVoted ? "Update vote" : "Vote"}
          </button>
        </div>
      )}
    </div>
  );
}
