import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export interface SortableColumn<T> {
  id: string;
  sortValue?: (row: T) => number | string | null | undefined;
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
