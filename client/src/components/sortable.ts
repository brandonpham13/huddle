/**
 * Sort state hook for the dashboard's hand-rolled tables.
 *
 * The dashboard tables (LeagueTable, PowerRankings) use a CSS grid layout
 * for their bespoke newspaper styling, so they can't drop into the generic
 * `<SortableTable>` `<table>` component. This hook gives them just the
 * sort *state* (active column + direction + sort comparator) while leaving
 * the rendering entirely up to the caller.
 *
 * Pair this with `<SortHeader>` from `widgets/dashboard/_shared.tsx` for
 * the clickable header cell. The orchestrator looks like:
 *
 *   ```tsx
 *   const cols: SortableColumn<Row>[] = [
 *     { id: "name", sortValue: r => r.name.toLowerCase(), defaultDir: "asc" },
 *     { id: "pts",  sortValue: r => r.points,             defaultDir: "desc" },
 *   ];
 *   const { sortedRows, sortId, sortDir, handleSort } =
 *     useSortedRows(rows, cols, "pts", "desc");
 *
 *   // header:
 *   <SortHeader id="pts" label="PTS" currentId={sortId} dir={sortDir} onSort={handleSort} />
 *
 *   // body:
 *   sortedRows.map(row => ...)
 *   ```
 */
import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

/** Column descriptor: how to extract the sort key + which direction to default to. */
export interface SortableColumn<T> {
  id: string;
  /** Comparator key. Return null/undefined to sink the row to the bottom. */
  sortValue?: (row: T) => number | string | null | undefined;
  /** Direction applied the first time the user clicks this column header. */
  defaultDir?: SortDir;
}

export function useSortedRows<T>(
  rows: T[],
  columns: SortableColumn<T>[],
  defaultSortId?: string | null,
  defaultDir: SortDir = "desc",
) {
  const [sortId, setSortId] = useState<string | null>(defaultSortId ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const handleSort = (id: string) => {
    if (sortId === id) {
      // Repeat clicks on the same column flip direction so the user can
      // toggle without having to reach for a second control.
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      // First click on a new column jumps to that column's preferred
      // initial direction (e.g. "name" → asc, "points" → desc).
      const col = columns.find((c) => c.id === id);
      setSortId(id);
      setSortDir(col?.defaultDir ?? "desc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortId) return rows;
    const col = columns.find((c) => c.id === sortId);
    if (!col?.sortValue) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a) ?? null;
      const bv = col.sortValue!(b) ?? null;
      // Null/undefined values always sink to the bottom regardless of
      // direction — sorting "missing data" mixed with real numbers is
      // never useful.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, columns, sortId, sortDir]);

  return { sortedRows, sortId, sortDir, handleSort };
}
