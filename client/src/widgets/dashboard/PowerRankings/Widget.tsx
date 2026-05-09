import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../../../components/Avatar";
import {
  useSortedRows,
  type SortableColumn,
} from "../../../components/sortable";
import {
  usePowerRankings,
  type PowerRankingRow,
} from "../../../hooks/usePowerRankings";
import { useDashboardData } from "../useDashboardData";
import { SectionHead, SortHeader } from "../_shared";

export default function PowerRankingsWidget() {
  const { selectedLeagueId } = useDashboardData();
  const { data: powerData } = usePowerRankings(selectedLeagueId);
  const columns = powerData?.columns ?? [];
  const rows = powerData?.rows ?? [];

  const sortColumns = useMemo<SortableColumn<PowerRankingRow>[]>(() => {
    const base: SortableColumn<PowerRankingRow>[] = [
      { id: "rank", sortValue: (r) => r.overallRank, defaultDir: "asc" },
      {
        id: "team",
        sortValue: (r) => r.teamName.toLowerCase(),
        defaultDir: "asc",
      },
    ];
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

  const gridStyle = {
    gridTemplateColumns: `18px 1fr ${columns
      .map(() => "minmax(40px, 56px)")
      .join(" ")}`,
  };

  return (
    <section>
      <SectionHead
        kicker="Editorial Index"
        title="Power Rankings"
        rule="Composite · this week"
      />
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
      {sortedRows.map((row) => (
        <Link
          key={row.rosterId}
          to={`/teams/${row.rosterId}`}
          className="grid items-center gap-1.5 py-1 border-b border-dotted border-line hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={gridStyle}
        >
          <div className="font-serif italic font-semibold text-xs text-muted">
            {row.overallRank}
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
            return (
              <div
                key={c.id}
                className="text-right font-mono text-[10.5px] text-body tabular-nums"
              >
                {score != null ? Number(score).toFixed(2) : "—"}
              </div>
            );
          })}
        </Link>
      ))}
    </section>
  );
}
