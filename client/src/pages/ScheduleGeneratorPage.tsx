/**
 * ScheduleGeneratorPage — client-side schedule generator, styled after
 * ffschedulemaker.com. Route: /schedule/generator (nested under
 * `ScheduleLayout`, see that file for the sub-nav pattern).
 *
 * Nothing here is persisted — matches ffschedulemaker.com's model of
 * "generate, tweak, export" with no accounts or saved state. Refreshing
 * the page starts over from the league's current rosters.
 *
 * This page owns all the generator state and passes it down to the widgets
 * in `widgets/scheduleGenerator/`, mirroring the DashboardPage ownership
 * pattern described in PLAYBOOK.md (single fetch/state owner, dumb widgets
 * below it):
 *
 *   - TeamRosterPanel      — auto-pulled team list, reorder / placeholders
 *   - ScheduleOptionsPanel — weeks + matches-per-opponent + the rivalry
 *                            weeks on/off toggle
 *   - LockedMatchupsPanel  — rivalry/pinned matchups; only rendered by this
 *                            page when the toggle above is on
 *   - ScheduleStatsRow     — matchup-frequency balance check, above the grid
 *   - GeneratedScheduleGrid — output grid, lock/swap edits, export
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { CalendarRange } from "lucide-react";
import { useAppSelector } from "../store/hooks";
import { useLeagueRosters, useLeagueUsers } from "../hooks/useSleeper";
import { TeamRosterPanel } from "../widgets/scheduleGenerator/TeamRosterPanel";
import { ScheduleOptionsPanel } from "../widgets/scheduleGenerator/ScheduleOptionsPanel";
import { LockedMatchupsPanel } from "../widgets/scheduleGenerator/LockedMatchupsPanel";
import { GeneratedScheduleGrid } from "../widgets/scheduleGenerator/GeneratedScheduleGrid";
import { ScheduleStatsRow } from "../widgets/scheduleGenerator/ScheduleStatsRow";
import { Btn } from "../widgets/scheduleGenerator/_shared";
import {
  generateSchedule,
  scheduleToCsv,
  scheduleToText,
  buildRivalryLockedMatchups,
  emptyRivalryRow,
  summarizeMatchupFrequency,
  MAX_TEAMS,
  type GeneratorTeam,
  type LockedMatchup,
  type RivalryRow,
  type ScheduleOptions,
  type GeneratedSchedule,
} from "../utils/scheduleGenerator";

let placeholderCounter = 0;

export function ScheduleGeneratorPage() {
  const selectedLeagueId = useAppSelector((state) => state.auth.selectedLeagueId);
  const { data: rosters } = useLeagueRosters(selectedLeagueId);
  const { data: leagueUsers } = useLeagueUsers(selectedLeagueId);

  const rosterTeams = useMemo<GeneratorTeam[]>(() => {
    if (!rosters) return [];
    return [...rosters]
      .sort((a, b) => a.rosterId - b.rosterId)
      .slice(0, MAX_TEAMS)
      .map((r) => {
        const user = r.ownerId ? leagueUsers?.find((u) => u.userId === r.ownerId) : null;
        return {
          id: String(r.rosterId),
          name: user?.teamName ?? user?.displayName ?? `Team ${r.rosterId}`,
          avatar: user?.avatar ?? null,
          rosterId: r.rosterId,
        };
      });
  }, [rosters, leagueUsers]);
  const leagueExceedsMax = (rosters?.length ?? 0) > MAX_TEAMS;

  const [teams, setTeams] = useState<GeneratorTeam[]>([]);
  // Reseed from the league whenever its roster set actually changes (not on
  // every render) so in-progress reordering/placeholders survive re-fetches.
  const rosterKey = rosterTeams.map((t) => t.id).join(",");
  useEffect(() => {
    setTeams(rosterTeams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterKey]);

  const [options, setOptions] = useState<ScheduleOptions>({
    weeks: 14,
    matchesPerOpponent: "auto",
  });
  // Grid-driven locks (see handleToggleLock) — separate from rivalry locks
  // so toggling rivalry weeks off/on never clobbers a manual lock, or
  // vice versa.
  const [manualLocked, setManualLocked] = useState<LockedMatchup[]>([]);

  // Rivalry weeks state lives here (not in LockedMatchupsPanel) specifically
  // so it survives the panel being unmounted when the toggle is off — see
  // that component's doc comment.
  const [rivalryWeeksEnabled, setRivalryWeeksEnabled] = useState(false);
  const [rivalryRows, setRivalryRows] = useState<RivalryRow[]>([]);
  const [rivalryWeeks, setRivalryWeeks] = useState<number[]>([]);

  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);

  // Keep the rivalry row count pinned to floor(teams/2), clearing any
  // selection that referenced a team no longer in the list (e.g. a removed
  // placeholder) without touching unaffected rows.
  const rivalryRowCount = Math.floor(teams.length / 2);
  useEffect(() => {
    const validIds = new Set(teams.map((t) => t.id));
    setRivalryRows((prev) => {
      const cleaned = prev.map((r) => ({
        teamAId: r.teamAId && validIds.has(r.teamAId) ? r.teamAId : null,
        teamBId: r.teamBId && validIds.has(r.teamBId) ? r.teamBId : null,
      }));
      if (cleaned.length === rivalryRowCount) return cleaned;
      if (cleaned.length < rivalryRowCount) {
        return [
          ...cleaned,
          ...Array.from({ length: rivalryRowCount - cleaned.length }, emptyRivalryRow),
        ];
      }
      return cleaned.slice(0, rivalryRowCount);
    });
  }, [teams, rivalryRowCount]);

  // Drop any selected rivalry week that's fallen outside the season length.
  useEffect(() => {
    setRivalryWeeks((prev) => prev.filter((w) => w <= options.weeks));
  }, [options.weeks]);

  // Only contributes to generation while the toggle is on; flipping it off
  // leaves rivalryRows/rivalryWeeks untouched so re-enabling recovers them.
  const rivalryLocked = useMemo(
    () => (rivalryWeeksEnabled ? buildRivalryLockedMatchups(rivalryRows, rivalryWeeks) : []),
    [rivalryWeeksEnabled, rivalryRows, rivalryWeeks],
  );

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const matchupFrequency = useMemo(
    () => (schedule ? summarizeMatchupFrequency(schedule, teams.map((t) => t.id)) : null),
    [schedule, teams],
  );

  function handleGenerate() {
    setSchedule(generateSchedule(teams, options, [...manualLocked, ...rivalryLocked]));
  }

  function handleAddPlaceholder() {
    if (teams.length >= MAX_TEAMS) return;
    placeholderCounter += 1;
    const id = `bye-${placeholderCounter}`;
    setTeams((prev) => [...prev, { id, name: `Placeholder ${placeholderCounter}`, avatar: null, rosterId: null }]);
  }

  function handleRemovePlaceholder(id: string) {
    setTeams((prev) => prev.filter((t) => t.id !== id));
  }

  function handleToggleLock(week: number, index: number) {
    // Read the matchup being toggled from the current `schedule` up front,
    // rather than from inside the setSchedule updater — an updater should
    // stay a pure function of its previous value, and triggering the
    // setManualLocked side effect from inside it would run twice under
    // StrictMode's double-invoke.
    const m = schedule?.weeks.find((w) => w.week === week)?.matchups[index];
    if (!m) return;
    const nowLocked = !m.locked;

    setSchedule((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        weeks: prev.weeks.map((w) => {
          if (w.week !== week) return w;
          const nextMatchups = [...w.matchups];
          nextMatchups[index] = { ...m, locked: nowLocked };
          return { ...w, matchups: nextMatchups };
        }),
      };
    });

    // Keep manualLocked (fed back into future regenerates) in sync.
    if (m.teamBId) {
      setManualLocked((prevLocked) => {
        const withoutThis = prevLocked.filter(
          (l) =>
            !(
              l.week === week &&
              ((l.teamAId === m.teamAId && l.teamBId === m.teamBId) ||
                (l.teamAId === m.teamBId && l.teamBId === m.teamAId))
            ),
        );
        return nowLocked
          ? [...withoutThis, { week, teamAId: m.teamAId, teamBId: m.teamBId! }]
          : withoutThis;
      });
    }
  }

  function handleSwapWithinWeek(week: number, indexA: number, indexB: number) {
    setSchedule((prev) => {
      if (!prev) return prev;
      const nextWeeks = prev.weeks.map((w) => {
        if (w.week !== week) return w;
        const nextMatchups = [...w.matchups];
        const a = nextMatchups[indexA];
        const b = nextMatchups[indexB];
        if (!a || !b || a.locked || b.locked) return w;
        nextMatchups[indexA] = { ...a, teamBId: b.teamBId };
        nextMatchups[indexB] = { ...b, teamBId: a.teamBId };
        return { ...w, matchups: nextMatchups };
      });
      return { ...prev, weeks: nextWeeks };
    });
  }

  function handleCopy() {
    if (!schedule) return;
    navigator.clipboard.writeText(scheduleToText(schedule, teamsById));
  }

  function handleDownloadCsv() {
    if (!schedule) return;
    const csv = scheduleToCsv(schedule, teamsById);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schedule.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!selectedLeagueId) return <Navigate to="/" replace />;

  return (
    <div className="px-3 sm:px-7 py-6 flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <CalendarRange size={18} className="text-muted shrink-0" />
          <h1 className="font-serif font-semibold text-xl text-ink">Schedule Generator</h1>
        </div>
        <p className="mt-1 text-[12.5px] text-muted font-sans">
          Generate a balanced season schedule for your league, pin rivalry weeks, then tweak
          and export it. Nothing here is saved — regenerate any time.
        </p>
      </div>

      {/* Config sections stay a readable form width — only the schedule
          output below benefits from the page's full width. */}
      <div className="max-w-4xl flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TeamRosterPanel
            teams={teams}
            onAddPlaceholder={handleAddPlaceholder}
            onRemovePlaceholder={handleRemovePlaceholder}
            truncatedFromLeague={leagueExceedsMax}
          />
          <ScheduleOptionsPanel
            options={options}
            onChange={setOptions}
            rivalryWeeksEnabled={rivalryWeeksEnabled}
            onRivalryWeeksEnabledChange={setRivalryWeeksEnabled}
          />
        </div>

        {rivalryWeeksEnabled && (
          <LockedMatchupsPanel
            teams={teams}
            weeks={options.weeks}
            rows={rivalryRows}
            onRowsChange={setRivalryRows}
            selectedWeeks={rivalryWeeks}
            onSelectedWeeksChange={setRivalryWeeks}
          />
        )}

        <div>
          <Btn variant="primary" onClick={handleGenerate} disabled={teams.length < 2}>
            {schedule ? "Regenerate schedule" : "Generate schedule"}
          </Btn>
        </div>
      </div>

      {schedule && matchupFrequency && (
        <>
          <ScheduleStatsRow summary={matchupFrequency} teamsById={teamsById} />
          <GeneratedScheduleGrid
            schedule={schedule}
            teamsById={teamsById}
            onToggleLock={handleToggleLock}
            onSwapWithinWeek={handleSwapWithinWeek}
            onRegenerate={handleGenerate}
            onCopy={handleCopy}
            onDownloadCsv={handleDownloadCsv}
          />
        </>
      )}
    </div>
  );
}
