/**
 * ScheduleStatsRow — a quick balance check above the generated grid: for
 * every unique pair of teams, how many times do they actually face off in
 * this schedule? Bucketed as "never play", "play once", "play twice", and
 * (rare, only shows up with a small team count / high week count) "play N×".
 *
 * Pure display over `summarizeMatchupFrequency` in `utils/scheduleGenerator.ts`
 * — the page computes/memoizes the summary and passes it in. The "Never
 * play" tile gets a hover tooltip listing exactly which pairs those are,
 * using `teamsById` (also already owned by the page) to resolve names.
 *
 * Also carries the never-play tooltip hint as a small legend at the bottom.
 * The badge / lock / swap legend lives with `GeneratedScheduleGrid`
 * instead, right above the grid those all describe.
 */
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { Panel, PanelHeader } from "./_shared";
import type { GeneratorTeam, MatchupFrequencySummary } from "../../utils/scheduleGenerator";

function bucketLabel(timesPlayed: number): string {
  if (timesPlayed === 0) return "Never play";
  if (timesPlayed === 1) return "Play once";
  if (timesPlayed === 2) return "Play twice";
  return `Play ${timesPlayed}×`;
}

export function ScheduleStatsRow({
  summary,
  teamsById,
}: {
  summary: MatchupFrequencySummary;
  teamsById: Map<string, GeneratorTeam>;
}) {
  const nameOf = (id: string) => teamsById.get(id)?.name ?? "Unknown";

  return (
    <Panel>
      <PanelHeader
        title="Matchup Balance"
        description={`Across ${summary.totalPairs} unique team pair${summary.totalPairs === 1 ? "" : "s"}.`}
      />
      <div className="flex flex-wrap gap-6 text-sm font-sans">
        {summary.buckets.map((b) => {
          const tile = (
            <div className={b.timesPlayed === 0 && b.pairCount > 0 ? "cursor-help" : undefined}>
              <span className="text-2xl font-serif font-bold text-ink">{b.pairCount}</span>
              <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">
                {bucketLabel(b.timesPlayed)}
              </p>
            </div>
          );

          if (b.timesPlayed !== 0 || b.pairCount === 0) {
            return <div key={b.timesPlayed}>{tile}</div>;
          }

          return (
            <Tooltip key={b.timesPlayed}>
              <TooltipTrigger asChild>{tile}</TooltipTrigger>
              <TooltipContent>
                <div className="flex flex-col gap-0.5">
                  {summary.neverPlayPairs.map(([a, b2]) => (
                    <span key={`${a}-${b2}`}>
                      {nameOf(a)} vs {nameOf(b2)}
                    </span>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {summary.neverPlayPairs.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11.5px] font-sans text-muted pt-1 border-t border-line">
          <Info size={12} className="shrink-0" />
          <span>
            Hover over "Never play" above to see exactly which team pairs don't face off this
            season.
          </span>
        </div>
      )}
    </Panel>
  );
}
