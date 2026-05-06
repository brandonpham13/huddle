import { useAppSelector } from '../../store/hooks'
import { useLeagueStandings } from '../../hooks/useSleeper'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'

export default function LeagueStandingsWidget() {
  const sleeperUsername = useAppSelector(state => state.auth.user?.sleeperUsername)
  const selectedLeagueId = useAppSelector(state => state.auth.selectedLeagueId)
  const { data: standings, isLoading, isError } = useLeagueStandings(selectedLeagueId)

  if (!sleeperUsername) {
    return (
      <Card>
        <CardHeader><CardTitle>League Standings</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Link your Sleeper account to see standings.</p>
        </CardContent>
      </Card>
    )
  }

  if (!selectedLeagueId) {
    return (
      <Card>
        <CardHeader><CardTitle>League Standings</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Select a league to see standings.</p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>League Standings</CardTitle></CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardHeader><CardTitle>League Standings</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">Failed to load standings.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>League Standings</CardTitle></CardHeader>
      <CardContent>
        {standings && standings.length > 0 ? (
          <div className="space-y-1">
            {standings.map((team, idx) => (
              <div key={team.roster_id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-semibold text-gray-500 w-5 shrink-0">{idx + 1}</span>
                  {team.avatar ? (
                    <img
                      src={`https://sleepercdn.com/avatars/thumbs/${team.avatar}`}
                      alt={team.team_name}
                      className="w-7 h-7 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
                  )}
                  <p className="text-sm font-medium truncate">{team.team_name}</p>
                </div>
                <div className="text-xs text-gray-500 shrink-0 ml-3 tabular-nums">
                  {team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ''} · {team.points_for.toFixed(1)} pts
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No standings available yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
