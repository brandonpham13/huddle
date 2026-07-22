/**
 * LockedMatchupsPanel — ffschedulemaker.com's "rivalry week" concept: pin
 * specific pairs of teams to face off in one or two shared rivalry weeks
 * before generating. The generator does a best-effort swap to honor these
 * (see `applyLockedMatchups` in `utils/scheduleGenerator.ts`); anything it
 * couldn't satisfy shows up as a warning after generating.
 *
 * Fully controlled — `rows` and `selectedWeeks` are owned by
 * `ScheduleGeneratorPage`, not local state here. That's deliberate: the page
 * only *mounts* this panel when "Enable rivalry weeks" is on (that toggle
 * lives in `ScheduleOptionsPanel`), and if the selections lived in this
 * component's own state they'd be wiped every time it unmounts on toggle-off.
 * Keeping the source of truth up a level means flipping the toggle off and
 * back on preserves whatever the user had filled in.
 *
 *   - A shared week picker lets you pick up to `MAX_RIVALRY_WEEKS` weeks
 *     that apply to every pinned rivalry (e.g. an early-season and a
 *     rematch-late-season week).
 *   - Exactly `floor(teams.length / 2)` team-pair rows are shown — the max
 *     number of non-overlapping pairings possible. Each team select
 *     defaults to unselected and, once a team is picked anywhere, it drops
 *     out of every other select's options (a team can only be part of one
 *     pinned rivalry). Row count / stale-team cleanup is handled by the page.
 */
import { useMemo } from "react";
import { Panel, PanelHeader } from "./_shared";
import {
  MAX_RIVALRY_WEEKS,
  type GeneratorTeam,
  type RivalryRow,
} from "../../utils/scheduleGenerator";

export function LockedMatchupsPanel({
  teams,
  weeks,
  rows,
  onRowsChange,
  selectedWeeks,
  onSelectedWeeksChange,
}: {
  teams: GeneratorTeam[];
  weeks: number;
  rows: RivalryRow[];
  onRowsChange: (rows: RivalryRow[]) => void;
  selectedWeeks: number[];
  onSelectedWeeksChange: (weeks: number[]) => void;
}) {
  const weekOptions = useMemo(() => Array.from({ length: weeks }, (_, i) => i + 1), [weeks]);

  function updateRow(index: number, patch: Partial<RivalryRow>) {
    onRowsChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function toggleWeek(week: number) {
    if (selectedWeeks.includes(week)) {
      onSelectedWeeksChange(selectedWeeks.filter((w) => w !== week));
      return;
    }
    if (selectedWeeks.length >= MAX_RIVALRY_WEEKS) return;
    onSelectedWeeksChange([...selectedWeeks, week].sort((a, b) => a - b));
  }

  const optionsFor = useMemo(
    () => (rowIndex: number, slot: "a" | "b") => {
      const current = slot === "a" ? rows[rowIndex]?.teamAId : rows[rowIndex]?.teamBId;
      const used = new Set<string>();
      rows.forEach((r, i) => {
        if (i === rowIndex) {
          const otherSlot = slot === "a" ? r.teamBId : r.teamAId;
          if (otherSlot) used.add(otherSlot);
          return;
        }
        if (r.teamAId) used.add(r.teamAId);
        if (r.teamBId) used.add(r.teamBId);
      });
      return teams.filter((t) => t.id === current || !used.has(t.id));
    },
    [rows, teams],
  );

  return (
    <Panel>
      <PanelHeader
        title="Rivalry Weeks"
        description="Pin teams to face a rival in one or two shared weeks before generating."
      />

      <div className="flex flex-col gap-4">
        {/* Shared week picker — applies to every rivalry row below */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted font-sans">
            Rivalry week{selectedWeeks.length === 2 ? "s" : ""} (pick up to {MAX_RIVALRY_WEEKS})
          </label>
          <div className="flex flex-wrap gap-1.5">
            {weekOptions.map((week) => {
              const isSelected = selectedWeeks.includes(week);
              const disabled = !isSelected && selectedWeeks.length >= MAX_RIVALRY_WEEKS;
              return (
                <button
                  key={week}
                  type="button"
                  onClick={() => toggleWeek(week)}
                  disabled={disabled}
                  className={`w-8 h-8 flex items-center justify-center rounded-md border text-[12px] font-mono transition-colors
                    disabled:opacity-30 disabled:cursor-not-allowed
                    ${
                      isSelected
                        ? "bg-ink text-paper border-ink"
                        : "border-line text-ink hover:bg-highlight"
                    }`}
                >
                  {week}
                </button>
              );
            })}
          </div>
          {selectedWeeks.length === 0 && (
            <p className="text-[11px] text-muted font-sans">
              Select at least one week to activate the rivalries below.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {rows.length === 0 && (
            <p className="text-[12.5px] text-muted font-sans">
              Need at least two teams to set up a rivalry.
            </p>
          )}
          {rows.map((row, i) => (
            <div
              key={i}
              className="flex flex-wrap items-end gap-2 font-sans text-sm border border-line rounded-md p-2.5"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted w-16">
                Rivalry {i + 1}
              </span>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Team A
                </label>
                <select
                  value={row.teamAId ?? ""}
                  onChange={(e) => updateRow(i, { teamAId: e.target.value || null })}
                  className="border border-line rounded-md px-2 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
                >
                  <option value="">Select team…</option>
                  {optionsFor(i, "a").map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-muted pb-1.5">vs</span>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Team B
                </label>
                <select
                  value={row.teamBId ?? ""}
                  onChange={(e) => updateRow(i, { teamBId: e.target.value || null })}
                  className="border border-line rounded-md px-2 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
                >
                  <option value="">Select team…</option>
                  {optionsFor(i, "b").map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
