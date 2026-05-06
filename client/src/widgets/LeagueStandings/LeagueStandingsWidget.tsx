import { useAppSelector } from '../../store/hooks'
import { useLeague, useLeagueRosters, useLeagueUsers } from '../../hooks/useSleeper'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Link } from 'react-router-dom'

export default function LeagueStandingsWidget() {
  const selectedLeagueId = useAppSelector(state => state.auth.selectedLeagueId)

  const { data: league } = useLeague(selectedLeagueId)
  const { data: rosters, isLoading: rostersLoading } = useLeagueRosters(selectedLeagueId)
  const { data: users, isLoading: usersLoading } = useLeagueUsers(selectedLeagueId)

  if (!selectedLeagueId) {
    return (
      <Card>
        <CardHeader><CardTitle>Standings</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            <Link to="/leagues" className="text-blue-600 hover:underline">Select a league</Link> to view standings.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (rostersLoading || usersLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Standings</CardTitle></CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
        </CardContent>
      </Card>
    )
  }

  // Build standings: join rosters with user display names, sort by wins then fpts
  const userMap = new Map(users?.map(u => [u.user_id, u]) ?? [])

  const standings = (rosters ?? [])
    .map(roster => {
      const user = roster.owner_id ? userMap.get(roster.owner_id) : null
      const teamName = user?.metadata?.team_name ?? user?.display_name ?? `Team ${roster.roster_id}`
      const avatar = user?.avatar ?? null
      const { wins = 0, losses = 0, ties = 0, fpts = 0, fpts_decimal = 0 } = roster.settings
      const totalFpts = fpts + fpts_decimal / 100
      return { roster_id: roster.roster_id, teamName, avatar, wins, losses, ties, totalFpts }
    })
    .sort((a, b) => b.wins - a.wins || b.totalFpts - a.totalFpts)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{league?.name ?? 'Standings'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* Header */}
          <div className="flex items-center justify-between text-xs text-gray-400 pb-1 border-b">
            <span>Team</span>
            <div className="flex gap-4">
              <span className="w-12 text-right">W-L-T</span>
              <span className="w-14 text-right">PF</span>
            </div>
          </div>
          {standings.map((team, i) => (
            <div key={team.roster_id} className="flex items-center justify-between py-1.5 gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                {team.avatar ? (
                  <img
                    src={`https://sleepercdn.com/avatars/thumbs/${team.avatar}`}
                    alt={team.teamName}
                    className="w-6 h-6 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200 shrink-0" />
                )}
                <span className="text-sm font-medium truncate">{team.teamName}</span>
              </div>
              <div className="flex gap-4 shrink-0">
                <span className="text-xs text-gray-600 w-12 text-right tabular-nums">
                  {team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ''}
                </span>
                <span className="text-xs text-gray-600 w-14 text-right tabular-nums">
                  {team.totalFpts.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
