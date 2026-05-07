import { useAppSelector } from "../../store/hooks";
import { usePowerRankings } from "../../hooks/usePowerRankings";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Link } from "react-router-dom";

export default function PowerRankingsWidget() {
  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );
  const { data, isLoading, isError } = usePowerRankings(selectedLeagueId);

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

  const { columns, rows } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Power Rankings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-400">
                <th className="text-left font-normal pb-2 w-6">#</th>
                <th className="text-left font-normal pb-2">Team</th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="text-right font-normal pb-2 pl-4"
                    title={col.description}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.rosterId} className="border-b last:border-b-0">
                  <td className="py-2 text-xs text-gray-400 w-6">{i + 1}</td>
                  <td className="py-2">
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
                      <span className="font-medium truncate">
                        {row.teamName}
                      </span>
                    </div>
                  </td>
                  {columns.map((col) => {
                    const score = row.scores[col.id];
                    return (
                      <td
                        key={col.id}
                        className="py-2 pl-4 text-right tabular-nums text-gray-600"
                      >
                        {score !== null && score !== undefined ? (
                          score.toFixed(3)
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={2 + columns.length}
                    className="py-8 text-center text-gray-400 text-sm"
                  >
                    No data yet — check back after week 1.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
