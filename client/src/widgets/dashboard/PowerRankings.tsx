/**
 * PowerRankings — the "Editorial Index" widget in the bottom-right of the
 * dashboard. Driven entirely by the server-supplied algorithm registry.
 *
 * How the columns get here:
 *   1. On the server, each algorithm registers itself via
 *      `registerAlgorithm()` in `server/src/services/powerRankingsService.ts`.
 *      Adding a new file under `server/src/algorithms/` automatically adds
 *      a new column here — no client changes needed.
 *   2. The `/power-rankings` endpoint returns `{ columns, rows }`. The
 *      `columns` array describes each registered algorithm (id, label,
 *      description, displayMode); the `rows` array contains, for each
 *      roster, that algorithm's score + derived rank.
 *   3. This widget renders one column per `columns` entry, with both
 *     `score` and `rank` display modes supported (`displayMode` on the
 *     column controls which field we read and how we format the cell).
 *
 * The leftmost `#` column is always the sequential position in the
 * current sort order (i + 1) — not a pre-computed float — so it reads
 * cleanly as ordinal placement regardless of which column the user sorted
 * by.
 *
 * Sorting:
 *   We use `useSortedRows` + `SortHeader` like LeagueTable. Rank-mode
 *   columns negate their value so a single descending comparator puts the
 *   best rank first regardless of column type.
 *
 * Layout:
 *   The grid template is generated at runtime (`gridTemplateColumns`) since
 *   the column count comes from the server. Wrapped in `overflow-x-auto` so
 *   adding many algorithm columns to a narrow `lg`-grid third column
 *   horizontally scrolls instead of overflowing.
 *
 * See PLAYBOOK.md → "Adding a column to Power Rankings" for the full
 * server-side recipe.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../../components/Avatar";
import { useSortedRows, type SortableColumn } from "../../components/sortable";
import type {
  PowerRankingColumn,
  PowerRankingRow,
} from "../../hooks/usePowerRankings";
import { SectionHead, SortHeader } from "./_shared";

export function PowerRankings({
  columns,
  rows,
}: {
  columns: PowerRankingColumn[];
  rows: PowerRankingRow[];
}) {
  const sortColumns = useMemo<SortableColumn<PowerRankingRow>[]>(() => {
    const base: SortableColumn<PowerRankingRow>[] = [
      { id: "rank", sortValue: (r) => r.overallRank, defaultDir: "asc" },
      {
        id: "team",
        sortValue: (r) => r.teamName.toLowerCase(),
        defaultDir: "asc",
      },
    ];
    // Build a sort entry per server-supplied algorithm column. Rank-mode
    // columns negate their value so a single "desc" comparator still puts
    // rank 1 (best) at the top — saves us from special-casing direction
    // per column type elsewhere.
    const algo = columns.map<SortableColumn<PowerRankingRow>>((c) => ({
      id: c.id,
      sortValue: (r) =>
        c.displayMode === "rank"
          ? -(r.ranks[c.id] ?? Infinity)
          : (r.scores[c.id] ?? null),
      defaultDir: "desc",
    }));
    return [...base, ...algo];
  }, [columns]);

  const { sortedRows, sortId, sortDir, handleSort } = useSortedRows(
    rows,
    sortColumns,
    "rank",
    "asc",
  );

  // Dynamic grid: rank + team + N data columns. Inline-style because the
  // column count varies and Tailwind needs static class strings. Team col uses
  // minmax so it shrinks to a sane minimum and the wrapper's overflow-x-auto
  // takes over once we run out of horizontal room (e.g., many algo columns
  // inside a narrow lg/3-col layout).
  const gridStyle = {
    gridTemplateColumns: `16px minmax(80px, 1fr) ${columns
      .map(() => "minmax(36px, 56px)")
      .join(" ")}`,
  };

  return (
    <section>
      <SectionHead
        kicker="Editorial Index"
        title="Power Rankings"
        rule="Composite · this week"
      />
      <div className="overflow-x-auto">
        <div
          className="grid items-baseline gap-1.5 text-[9.5px] font-semibold tracking-wider uppercase text-muted font-sans border-b border-line pb-1 mb-0.5"
          style={gridStyle}
        >
          <SortHeader
            id="rank"
            label="#"
            currentId={sortId}
            dir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            id="team"
            label="Team"
            currentId={sortId}
            dir={sortDir}
            onSort={handleSort}
          />
          {columns.map((c) => (
            <SortHeader
              key={c.id}
              id={c.id}
              label={c.label}
              currentId={sortId}
              dir={sortDir}
              onSort={handleSort}
              align="right"
              className="truncate"
            />
          ))}
        </div>
        {sortedRows.map((row, i) => (
          <Link
            key={row.rosterId}
            to={`/teams/${row.rosterId}`}
            className="grid items-center gap-1.5 py-1 border-b border-dotted border-line hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            style={gridStyle}
          >
            {/* Sequential placement (1-based index in the current sorted order) */}
            <div className="font-serif italic font-semibold text-xs text-muted">
              {i + 1}
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar avatar={row.avatar} name={row.teamName} size={14} />
              <span className="font-serif text-[12.5px] text-ink truncate">
                {row.teamName}
              </span>
            </div>
            {columns.map((c) => {
              if (c.displayMode === "rank") {
                const rank = row.ranks[c.id];
                return (
                  <div
                    key={c.id}
                    className="text-right font-mono text-[10.5px] text-body tabular-nums"
                  >
                    {rank != null ? `#${rank}` : "—"}
                  </div>
                );
              }
              const score = row.scores[c.id];
              // Format as integer when the score is a whole number (e.g.
              // all-play wins), otherwise two decimal places.
              const formatted =
                score != null
                  ? Number.isInteger(score)
                    ? String(score)
                    : Number(score).toFixed(2)
                  : "—";
              return (
                <div
                  key={c.id}
                  className="text-right font-mono text-[10.5px] text-body tabular-nums"
                >
                  {formatted}
                </div>
              );
            })}
          </Link>
        ))}
      </div>
    </section>
  );
}
