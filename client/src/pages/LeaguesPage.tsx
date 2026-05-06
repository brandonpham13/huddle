import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { setSelectedLeague } from '../store/slices/authSlice'
import { useSleeperLeagues, useSyncLeagues } from '../hooks/useSleeper'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

function leagueStatusBadge(status: string) {
  const map: Record<string, string> = {
    in_season: 'bg-green-100 text-green-800',
    pre_draft: 'bg-yellow-100 text-yellow-800',
    drafting: 'bg-blue-100 text-blue-800',
    complete: 'bg-gray-100 text-gray-600',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

export function LeaguesPage() {
  const dispatch = useAppDispatch()
  const sleeperUsername = useAppSelector(state => state.auth.user?.sleeperUsername)
  const syncedLeagueIds = useAppSelector(state => state.auth.user?.syncedLeagueIds ?? [])
  const year = useAppSelector(state => state.auth.selectedYear)

  const { data: leagues, isLoading, isError } = useSleeperLeagues()
  const syncMutation = useSyncLeagues()

  const [pendingIds, setPendingIds] = useState<string[]>(syncedLeagueIds)

  const toggleLeague = (leagueId: string) => {
    setPendingIds(prev =>
      prev.includes(leagueId)
        ? prev.filter(id => id !== leagueId)
        : [...prev, leagueId]
    )
  }

  const hasChanges = JSON.stringify([...pendingIds].sort()) !== JSON.stringify([...syncedLeagueIds].sort())

  const handleSave = () => {
    syncMutation.mutate(pendingIds)
  }

  // Suppress unused variable warning
  void dispatch
  void setSelectedLeague

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">← Dashboard</Link>
        <h1 className="text-xl font-bold">My Leagues</h1>
      </nav>

      <main className="p-6 max-w-2xl mx-auto space-y-4">
        {!sleeperUsername ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500 mb-4">Link your Sleeper account to see your leagues.</p>
              <Link to="/account">
                <Button>Go to Settings</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{year} Leagues</CardTitle>
                <CardDescription>
                  Select leagues to sync to your dashboard. Synced leagues appear in your league switcher.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading && (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
                  </div>
                )}

                {isError && (
                  <p className="text-sm text-red-500">Failed to load leagues. Check that your Sleeper username is correct.</p>
                )}

                {leagues && leagues.length === 0 && (
                  <p className="text-sm text-gray-500">No leagues found for {sleeperUsername} in {year}.</p>
                )}

                {leagues && leagues.length > 0 && (
                  <div className="space-y-2">
                    {leagues.map(league => {
                      const isSynced = pendingIds.includes(league.league_id)
                      return (
                        <div
                          key={league.league_id}
                          className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                            isSynced ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-gray-50'
                          }`}
                          onClick={() => toggleLeague(league.league_id)}
                        >
                          <div className="flex items-center gap-3">
                            {league.avatar ? (
                              <img
                                src={`https://sleepercdn.com/avatars/thumbs/${league.avatar}`}
                                alt={league.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">
                                {league.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-sm">{league.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${leagueStatusBadge(league.status)}`}>
                                  {league.status.replace('_', ' ')}
                                </span>
                                <span className="text-xs text-gray-400">{league.total_rosters} teams</span>
                              </div>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSynced ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                          }`}>
                            {isSynced && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {leagues && leagues.length > 0 && (
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {pendingIds.length} league{pendingIds.length !== 1 ? 's' : ''} selected
                    </span>
                    <Button
                      onClick={handleSave}
                      disabled={!hasChanges || syncMutation.isPending}
                    >
                      {syncMutation.isPending ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                )}

                {syncMutation.isSuccess && !hasChanges && (
                  <p className="text-sm text-green-600 mt-2">Leagues synced!</p>
                )}
                {syncMutation.isError && (
                  <p className="text-sm text-red-500 mt-2">Failed to save. Please try again.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
