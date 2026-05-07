import { useAppSelector } from "../../store/hooks";
import {
  useLeague,
  useLeagueRosters,
  useLeagueUsers,
} from "../../hooks/useSleeper";
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

interface StandingsRow {
  rosterId: number;
  teamName: string;
  avatar: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

const COLUMNS: TableColumn<StandingsRow>[] = [
  {
    id: "rank",
    label: "#",
    align: "left",
    render: (_row, i) => <span className="text-xs text-gray-400">{i + 1}</span>,
  },
  {
    id: "team",
    label: "Team",
    align: "left",
    render: (row) => (
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
    ),
  },
  {
    id: "record",
    label: "W-L-T",
    align: "right",
    title: "Win-Loss-Tie record",
    sortValue: (row) => row.wins + row.ties * 0.5,
    render: (row) => (
      <span className="text-xs text-gray-600">
        {row.wins}-{row.losses}
        {row.ties > 0 ? `-${row.ties}` : ""}
      </span>
    ),
  },
  {
    id: "pf",
    label: "PF",
    align: "right",
    title: "Points For",
    sortValue: (row) => row.pointsFor,
    render: (row) => (
      <span className="text-xs text-gray-600">{row.pointsFor.toFixed(2)}</span>
    ),
  },
  {
    id: "pa",
    label: "PA",
    align: "right",
    title: "Points Against",
    sortValue: (row) => row.pointsAgainst,
    render: (row) => (
      <span className="text-xs text-gray-600">
        {row.pointsAgainst.toFixed(2)}
      </span>
    ),
  },
];

export default function LeagueStandingsWidget() {
  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );

  const { data: league } = useLeague(selectedLeagueId);
  const { data: rosters, isLoading: rostersLoading } =
    useLeagueRosters(selectedLeagueId);
  const { data: users, isLoading: usersLoading } =
    useLeagueUsers(selectedLeagueId);

  if (!selectedLeagueId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            <Link to="/leagues" className="text-blue-600 hover:underline">
              Select a league
            </Link>{" "}
            to view standings.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (rostersLoading || usersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
        </CardContent>
      </Card>
    );
  }

  const userMap = new Map(users?.map((u) => [u.userId, u]) ?? []);

  const rows: StandingsRow[] = (rosters ?? []).map((roster) => {
    const user = roster.ownerId ? userMap.get(roster.ownerId) : null;
    return {
      rosterId: roster.rosterId,
      teamName:
        user?.teamName ?? user?.displayName ?? `Team ${roster.rosterId}`,
      avatar: user?.avatar ?? null,
      wins: roster.record?.wins ?? 0,
      losses: roster.record?.losses ?? 0,
      ties: roster.record?.ties ?? 0,
      pointsFor: roster.pointsFor ?? 0,
      pointsAgainst: roster.pointsAgainst ?? 0,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{league?.name ?? "Standings"}</CardTitle>
      </CardHeader>
      <CardContent>
        <SortableTable
          columns={COLUMNS}
          rows={rows}
          getKey={(r) => r.rosterId}
          defaultSortId="record"
          defaultSortDir="desc"
          emptyMessage="No rosters loaded yet."
        />
      </CardContent>
    </Card>
  );
}
