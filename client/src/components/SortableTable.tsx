import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export interface TableColumn<T> {
  /** Unique key for this column */
  id: string;
  /** Header label */
  label: string;
  /** Optional tooltip shown on header hover */
  title?: string;
  /** Alignment of header + cells */
  align?: "left" | "right" | "center";
  /** Return a number/string for sorting; null/undefined = not sortable */
  sortValue?: (row: T) => number | string | null | undefined;
  /** Render the cell content */
  render: (row: T, index: number) => React.ReactNode;
}

interface SortableTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  getKey: (row: T) => string | number;
  /** Column id to sort by initially */
  defaultSortId?: string;
  defaultSortDir?: "asc" | "desc";
  emptyMessage?: string;
}

export function SortableTable<T>({
  columns,
  rows,
  getKey,
  defaultSortId,
  defaultSortDir = "desc",
  emptyMessage = "No data available.",
}: SortableTableProps<T>) {
  const [sortId, setSortId] = useState<string | null>(defaultSortId ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);

  const handleSort = (colId: string) => {
    if (sortId === colId) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortId(colId);
      setSortDir("desc");
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    if (!sortId) return 0;
    const col = columns.find((c) => c.id === sortId);
    if (!col?.sortValue) return 0;
    const av = col.sortValue(a) ?? null;
    const bv = col.sortValue(b) ?? null;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "desc" ? -cmp : cmp;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {columns.map((col) => {
              const isSorted = sortId === col.id;
              const sortable = !!col.sortValue;
              const align = col.align ?? "left";
              return (
                <th
                  key={col.id}
                  title={col.title}
                  onClick={sortable ? () => handleSort(col.id) : undefined}
                  className={[
                    "pb-2 text-xs font-normal text-gray-400",
                    align === "right"
                      ? "text-right"
                      : align === "center"
                        ? "text-center"
                        : "text-left",
                    sortable
                      ? "cursor-pointer select-none hover:text-gray-700"
                      : "",
                    isSorted ? "text-gray-700" : "",
                  ].join(" ")}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {col.label}
                    {sortable && (
                      <span className="text-gray-300">
                        {isSorted ? (
                          sortDir === "desc" ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )
                        ) : (
                          <ChevronsUpDown size={12} />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => (
            <tr key={getKey(row)} className="border-b last:border-b-0">
              {columns.map((col) => {
                const align = col.align ?? "left";
                return (
                  <td
                    key={col.id}
                    className={[
                      "py-2",
                      align === "right"
                        ? "text-right tabular-nums"
                        : align === "center"
                          ? "text-center"
                          : "",
                    ].join(" ")}
                  >
                    {col.render(row, i)}
                  </td>
                );
              })}
            </tr>
          ))}
          {sortedRows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="py-8 text-center text-gray-400 text-sm"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
