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
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
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
