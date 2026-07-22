/**
 * GeneratedScheduleGrid — the output of `generateSchedule()`, rendered as
 * one card per week. Two manual-edit affordances live here:
 *
 *   - Lock (pin icon): marks a matchup so the next "Regenerate" call
 *     preserves it (fed back in as a `LockedMatchup` by the page).
 *   - Swap: click the swap icon on two matchups *in the same week* to
 *     exchange their opponents. This is the only edit that can't corrupt
 *     the "each team plays once per week" invariant, since all four teams
 *     stay in that same week either way.
 *
 * Every matchup also gets a tiny "1st"/"2nd"/"3rd" badge showing which
 * meeting this is for that specific pair of teams this season (from
 * `computeMeetingNumbers`), so a repeat matchup is obvious at a glance
 * without cross-referencing the Matchup Balance stats above.
 *
 * Export actions (copy / CSV) are passed in from the page so this component
 * stays a pure renderer over the schedule + teams it's given. All three
 * "how to read this" legend lines (badge, lock, swap) live here together,
 * right above the grid they describe; only the never-play tooltip hint
 * lives separately in `ScheduleStatsRow`, since it explains that panel's
 * own "Never play" tile rather than anything in this grid.
 */
import { useMemo, useState } from "react";
import { Lock, LockOpen, Repeat, Download, Copy, RefreshCw } from "lucide-react";
import { Btn, ordinal } from "./_shared";
import {
  computeMeetingNumbers,
  type GeneratedSchedule,
  type GeneratorTeam,
} from "../../utils/scheduleGenerator";

/** The small "1st"/"2nd" pill used both in the legend and on real matchups. */
function MeetingBadge({ n, title }: { n: number; title?: string }) {
  return (
    <span
      title={title}
      className="text-[9px] leading-none font-mono text-muted bg-highlight px-1 py-0.5 rounded shrink-0"
    >
      {ordinal(n)}
    </span>
  );
}

export function GeneratedScheduleGrid({
  schedule,
  teamsById,
  onToggleLock,
  onSwapWithinWeek,
  onRegenerate,
  onCopy,
  onDownloadCsv,
}: {
  schedule: GeneratedSchedule;
  teamsById: Map<string, GeneratorTeam>;
  onToggleLock: (week: number, index: number) => void;
  onSwapWithinWeek: (week: number, indexA: number, indexB: number) => void;
  onRegenerate: () => void;
  onCopy: () => void;
  onDownloadCsv: () => void;
}) {
  const [swapPick, setSwapPick] = useState<{ week: number; index: number } | null>(null);
  const meetingNumbers = useMemo(() => computeMeetingNumbers(schedule), [schedule]);

  const nameOf = (id: string | null) =>
    id ? (teamsById.get(id)?.name ?? "Unknown") : "BYE";
  const avatarOf = (id: string | null) => (id ? teamsById.get(id)?.avatar ?? null : null);

  function handleSwapClick(week: number, index: number) {
    if (!swapPick) {
      setSwapPick({ week, index });
      return;
    }
    if (swapPick.week !== week) {
      // Swaps only make sense within the same week — restart the pick.
      setSwapPick({ week, index });
      return;
    }
    if (swapPick.index === index) {
      setSwapPick(null);
      return;
    }
    onSwapWithinWeek(week, swapPick.index, index);
    setSwapPick(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11.5px] font-sans text-muted">
            <MeetingBadge n={2} />
            <span>Badges like this show which meeting it is between those two teams this season.</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11.5px] font-sans text-muted">
            <Lock size={12} className="shrink-0" />
            <span>Click the lock icon to keep a matchup fixed the next time you regenerate.</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11.5px] font-sans text-muted">
            <Repeat size={12} className="shrink-0" />
            <span>Click the swap icon on two matchups in the same week to trade opponents.</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Btn onClick={onRegenerate}>
            <RefreshCw size={13} />
            Regenerate
          </Btn>
          <Btn onClick={onCopy}>
            <Copy size={13} />
            Copy
          </Btn>
          <Btn onClick={onDownloadCsv}>
            <Download size={13} />
            Download CSV
          </Btn>
        </div>
      </div>

      {schedule.warnings.length > 0 && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-900 px-3 py-2 flex flex-col gap-1">
          {schedule.warnings.map((w, i) => (
            <p key={i} className="text-[11.5px] font-sans text-yellow-800 dark:text-yellow-300">
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Auto-fit instead of fixed breakpoint columns so cards actually grow
          to use the page's full width — a 3-column cap on a wide screen
          left cards narrow enough that team names truncated harshly. */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
        {schedule.weeks.map((week) => (
          <div key={week.week} className="border border-line rounded-lg bg-paper p-3 flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Week {week.week}
            </p>
            {week.matchups.length === 0 && (
              <p className="text-[12px] text-muted font-sans italic">Open — no matchups yet.</p>
            )}
            {week.matchups.map((m, i) => {
              const isPicked = swapPick?.week === week.week && swapPick.index === i;
              const meetingNumber = meetingNumbers.get(`${week.week}-${i}`);
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[12.5px] font-sans transition-colors
                    ${isPicked ? "border-ink bg-highlight" : "border-line"}`}
                >
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    {avatarOf(m.teamAId) && (
                      <img
                        src={`https://sleepercdn.com/avatars/thumbs/${avatarOf(m.teamAId)}`}
                        alt=""
                        className="w-4 h-4 rounded-full shrink-0 object-cover"
                      />
                    )}
                    <span className="truncate text-ink">{nameOf(m.teamAId)}</span>
                    <span className="text-muted shrink-0">vs</span>
                    {avatarOf(m.teamBId) && (
                      <img
                        src={`https://sleepercdn.com/avatars/thumbs/${avatarOf(m.teamBId)}`}
                        alt=""
                        className="w-4 h-4 rounded-full shrink-0 object-cover"
                      />
                    )}
                    <span className="truncate text-ink">{nameOf(m.teamBId)}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {meetingNumber !== undefined && (
                      <MeetingBadge
                        n={meetingNumber}
                        title={`${ordinal(meetingNumber)} meeting between these teams this season`}
                      />
                    )}
                    <button
                      onClick={() => onToggleLock(week.week, i)}
                      aria-label={m.locked ? "Unlock matchup" : "Lock matchup"}
                      title={m.locked ? "Unlock" : "Lock so regenerate keeps this"}
                      className={`p-1 ${m.locked ? "text-accent" : "text-muted hover:text-ink"}`}
                    >
                      {m.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                    </button>
                    <button
                      onClick={() => handleSwapClick(week.week, i)}
                      aria-label="Pick for swap"
                      title="Swap opponent with another matchup this week"
                      disabled={m.teamBId === null}
                      className="p-1 text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Repeat size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
