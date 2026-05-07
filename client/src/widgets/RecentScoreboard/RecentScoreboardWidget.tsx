import { useAppSelector } from '../../store/hooks'
import {
  useLeague,
  useLeagueMatchups,
  useLeagueRosters,
  useLeagueUsers,
  useNFLState,
} from '../../hooks/useSleeper'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Link } from 'react-router-dom'

const PAST_SEASON_DEFAULT_WEEK = 17

interface ScoreboardSide {
  rosterId: number
  teamName: string
  avatar: string | null
  points: number
}

interface ScoreboardPair {
  matchupId: number
  home: ScoreboardSide
  away: ScoreboardSide | null
}

export default function RecentScoreboardWidget() {
  const selectedLeagueId = useAppSelector(state => state.auth.selectedLeagueId)

  const { data: league } = useLeague(selectedLeagueId)
  const { data: nflState } = useNFLState()

  const week = (() => {
    if (!league || !nflState) return 0
    if (league.season === nflState.season) return Math.max(1, nflState.display_week)
    return PAST_SEASON_DEFAULT_WEEK
  })()

  const { data: matchups, isLoading: matchupsLoading } = useLeagueMatchups(selectedLeagueId, week)
  const { data: rosters } = useLeagueRosters(selectedLeagueId)
  const { data: users } = useLeagueUsers(selectedLeagueId)

  if (!selectedLeagueId) {
    return (
      <Card>
        <CardHeader><CardTitle>Scoreboard</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            <Link to="/leagues" className="text-blue-600 hover:underline">Select a league</Link> to view matchups.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!week || matchupsLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Scoreboard</CardTitle></CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
        </CardContent>
      </Card>
    )
  }

  const userMap = new Map(users?.map(u => [u.userId, u]) ?? [])
  const rosterMap = new Map(rosters?.map(r => [r.rosterId, r]) ?? [])

  const sideFor = (rosterId: number, points: number): ScoreboardSide => {
    const roster = rosterMap.get(rosterId)
    const user = roster?.ownerId ? userMap.get(roster.ownerId) : null
    return {
      rosterId,
      teamName: user?.teamName ?? user?.displayName ?? `Team ${rosterId}`,
      avatar: user?.avatar ?? null,
      points,
    }
  }

  // Group by matchupId. Sleeper pairs two rosters per matchupId. Byes have unique matchupId with one entry.
  const pairsById = new Map<number, ScoreboardPair>()

  for (const m of matchups ?? []) {
    if (m.matchupId == null) continue
    const side = sideFor(m.rosterId, m.points)
    const existing = pairsById.get(m.matchupId)
    if (existing) {
      existing.away = side
    } else {
      pairsById.set(m.matchupId, { matchupId: m.matchupId, home: side, away: null })
    }
  }

  const pairs = [...pairsById.values()]
    .sort((a, b) => a.matchupId - b.matchupId)
    .map(p => {
      // Put higher-scoring side on the left for visual consistency
      if (p.away && p.away.points > p.home.points) {
        return { ...p, home: p.away, away: p.home }
      }
      return p
    })

  if (pairs.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Week {week} Scoreboard</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No matchups available for week {week} yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Week {week} Scoreboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {pairs.map(pair => (
            <MatchupRow key={pair.matchupId} pair={pair} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function MatchupRow({ pair }: { pair: ScoreboardPair }) {
  const { home, away } = pair
  const homeWins = away ? home.points > away.points : false
  const awayWins = away ? away.points > home.points : false

  return (
    <div className="border rounded-md px-3 py-2 bg-gray-50/50">
      <Side side={home} winning={homeWins} />
      {away ? (
        <>
          <div className="text-[10px] text-gray-400 text-center my-0.5">vs</div>
          <Side side={away} winning={awayWins} />
        </>
      ) : (
        <div className="text-xs text-gray-400 mt-1">Bye</div>
      )}
    </div>
  )
}

function Side({ side, winning }: { side: ScoreboardSide; winning: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {side.avatar ? (
          <img
            src={`https://sleepercdn.com/avatars/thumbs/${side.avatar}`}
            alt={side.teamName}
            className="w-6 h-6 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-200 shrink-0" />
        )}
        <span className={`text-sm truncate ${winning ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
          {side.teamName}
        </span>
      </div>
      <span className={`text-sm tabular-nums shrink-0 ${winning ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
        {side.points.toFixed(2)}
      </span>
    </div>
  )
}
