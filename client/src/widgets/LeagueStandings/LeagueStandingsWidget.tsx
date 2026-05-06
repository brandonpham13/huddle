import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useAppSelector } from '../../store/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'

interface League {
  league_id: string
  name: string
  season: string
  status: string
  total_rosters: number
}

async function fetchLeagues(username: string): Promise<League[]> {
  const year = new Date().getFullYear().toString()
  // First get user id
  const userRes = await axios.get<{ user: { user_id: string } }>(`/api/sleeper/user/${username}`)
  const userId = userRes.data.user.user_id
  const leaguesRes = await axios.get<{ user: League[] }>(`/api/sleeper/user/${userId}/leagues/${year}`)
  return leaguesRes.data.user ?? []
}

export default function LeagueStandingsWidget() {
  const sleeperUsername = useAppSelector(state => state.auth.user?.sleeperUsername)

  const { data: leagues, isLoading, isError } = useQuery({
    queryKey: ['sleeper-leagues', sleeperUsername],
    queryFn: () => fetchLeagues(sleeperUsername!),
    enabled: !!sleeperUsername,
  })

  if (!sleeperUsername) {
    return (
      <Card>
        <CardHeader><CardTitle>League Standings</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            <Link to="/settings" className="text-blue-600 hover:underline">Link your Sleeper account</Link> to see your leagues.
          </p>
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
          <p className="text-sm text-red-500">Failed to load leagues.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>League Standings</CardTitle></CardHeader>
      <CardContent>
        {leagues && leagues.length > 0 ? (
          <div className="space-y-2">
            {leagues.map(league => (
              <div key={league.league_id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{league.name}</p>
                  <p className="text-xs text-gray-500">{league.total_rosters} teams · {league.status}</p>
                </div>
                <span className="text-xs text-gray-400">{league.season}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No leagues found for {sleeperUsername}.</p>
        )}
      </CardContent>
    </Card>
  )
}
