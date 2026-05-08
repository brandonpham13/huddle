import { useMemo } from "react";
import { useAppSelector } from "../../store/hooks";
import {
  usePowerRankings,
  type PowerRankingRow,
} from "../../hooks/usePowerRankings";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  SortableTable,
  type TableColumn,
} from "../../components/SortableTable";
import { Link } from "react-router-dom";

function TeamCell({ row }: { row: PowerRankingRow }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {row.avatar ? (
        <img
          src={`https://sleepercdn.com/avatars/thumbs/${row.avatar}`}
          alt={row.teamName}
          className="w-6 h-6 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-6 h-6 rounded-full bg-gray-200 shrink-0" />
      )}
      <span className="font-medium truncate">{row.teamName}</span>
    </div>
  );
}

export default function PowerRankingsWidget() {
  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );
  const { data, isLoading, isError } = usePowerRankings(selectedLeagueId);

  const columns = useMemo<TableColumn<PowerRankingRow>[]>(() => {
    const base: TableColumn<PowerRankingRow>[] = [
      {
        id: "rank",
        label: "#",
        align: "left",
        render: (_row, i) => (
          <span className="text-xs text-gray-400">{i + 1}</span>
        ),
      },
      {
        id: "team",
        label: "Team",
        align: "left",
        render: (row) => <TeamCell row={row} />,
      },
    ];

    const algoCols: TableColumn<PowerRankingRow>[] = (data?.columns ?? []).map(
      (col) => ({
        id: col.id,
        label: col.label,
        title: col.description,
        align: "right" as const,
        // Rank-mode columns: negate rank so higher (better) rank sorts first
        sortValue: (row: PowerRankingRow) =>
          col.displayMode === "rank"
            ? -(row.ranks[col.id] ?? Infinity)
            : (row.scores[col.id] ?? null),
        render: (row: PowerRankingRow) => {
          if (col.displayMode === "rank") {
            const rank = row.ranks[col.id];
            return rank !== null && rank !== undefined ? (
              <span className="text-xs text-gray-600">#{rank}</span>
            ) : (
              <span className="text-gray-300 text-xs">—</span>
            );
          }
          const score = row.scores[col.id];
          return score !== null && score !== undefined ? (
            <span className="text-xs text-gray-600">{score.toFixed(3)}</span>
          ) : (
            <span className="text-gray-300 text-xs">—</span>
          );
        },
      }),
    );

    return [...base, ...algoCols];
  }, [data?.columns]);

  if (!selectedLeagueId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Power Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            <Link to="/leagues" className="text-blue-600 hover:underline">
              Select a league
            </Link>{" "}
            to view power rankings.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Power Rankings</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Power Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">Failed to load power rankings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Power Rankings</CardTitle>
      </CardHeader>
      <CardContent>
        <SortableTable
          columns={columns}
          rows={data.rows}
          getKey={(r) => r.rosterId}
          defaultSortId={data.columns[0]?.id}
          defaultSortDir="desc"
          emptyMessage="No data yet — check back after week 1."
        />
      </CardContent>
    </Card>
  );
}
