import { useState, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { useSignOut } from '../hooks/useSignOut'
import { useAccountModal } from '../components/AccountModal'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { addWidget, removeWidget } from '../store/slices/widgetSlice'
import { setSelectedLeague } from '../store/slices/authSlice'
import { getAllWidgets } from '../widgets/registry'
import { useSleeperLeagues, useLeague, useLeagueHistory } from '../hooks/useSleeper'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

// Register widgets
import '../widgets/LeagueStandings'

export function DashboardPage() {
  const dispatch = useAppDispatch()
  const activeWidgets = useAppSelector(state => state.widget.activeWidgets)
  const syncedLeagueIds = useAppSelector(state => state.auth.user?.syncedLeagueIds ?? [])
  const selectedLeagueId = useAppSelector(state => state.auth.selectedLeagueId)
  const [showModal, setShowModal] = useState(false)
  const [rootLeagueId, setRootLeagueId] = useState<string | null>(selectedLeagueId)
  const { signOut } = useSignOut()
  const { open: openAccountModal } = useAccountModal()
  const allWidgets = getAllWidgets()

  const { data: allLeagues } = useSleeperLeagues()
  const syncedLeagues = allLeagues?.filter(l => syncedLeagueIds.includes(l.ref.leagueId)) ?? []
  const { data: selectedLeague } = useLeague(selectedLeagueId)
  const { data: leagueHistory } = useLeagueHistory(rootLeagueId)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Fantasy Analytics</h1>

          {/* League switcher */}
          {syncedLeagues.length > 0 && (
            <div className="flex items-center gap-1 border rounded-lg p-1 bg-gray-50">
              {syncedLeagues.map(league => (
                <button
                  key={league.ref.leagueId}
                  onClick={() => { setRootLeagueId(league.ref.leagueId); dispatch(setSelectedLeague(league.ref.leagueId)) }}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                    selectedLeagueId === league.ref.leagueId
                      ? 'bg-white shadow text-gray-900'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {league.name}
                </button>
              ))}
            </div>
          )}

          {syncedLeagues.length === 0 && (
            <Link to="/leagues" className="text-sm text-blue-600 hover:underline">
              Sync a league to get started
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Link to="/leagues" className="text-sm text-gray-600 hover:text-gray-900">Leagues</Link>
          <button onClick={openAccountModal} className="text-sm text-gray-600 hover:text-gray-900">Account</button>
          <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </nav>

      {/* Dashboard */}
      <main className="p-6">
        {/* Context bar */}
        {selectedLeague && (
          <div className="mb-4 flex items-center gap-2">
            {selectedLeague.avatar && (
              <img
                src={`https://sleepercdn.com/avatars/thumbs/${selectedLeague.avatar}`}
                alt={selectedLeague.name}
                className="w-6 h-6 rounded-full"
              />
            )}
            <span className="text-sm font-medium text-gray-700">{selectedLeague.name}</span>
            <span className="text-xs text-gray-400">· {selectedLeague.totalRosters} teams</span>
            {leagueHistory && leagueHistory.length > 0 && (
              <select
                value={selectedLeague.season}
                onChange={e => {
                  const entry = leagueHistory.find(h => h.season === e.target.value)
                  if (entry) dispatch(setSelectedLeague(entry.leagueId))
                }}
                className="ml-1 text-xs border rounded-md px-2 py-0.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {leagueHistory.map(h => (
                  <option key={h.leagueId} value={h.season}>{h.season}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Dashboard</h2>
          {selectedLeagueId && (
            <Button onClick={() => setShowModal(true)}>+ Add Widget</Button>
          )}
        </div>

        {!selectedLeagueId && syncedLeagues.length > 0 && (
          <div className="text-center text-gray-400 py-20">
            Select a league above to view your dashboard.
          </div>
        )}

        {selectedLeagueId && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeWidgets.map(widgetId => {
              const def = allWidgets.find(w => w.id === widgetId)
              if (!def) return null
              const WidgetComponent = def.component
              return (
                <div key={widgetId} className="relative">
                  <button
                    onClick={() => dispatch(removeWidget(widgetId))}
                    className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs text-gray-500"
                  >
                    ✕
                  </button>
                  <Suspense fallback={
                    <Card>
                      <CardContent className="p-8 flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
                      </CardContent>
                    </Card>
                  }>
                    <WidgetComponent />
                  </Suspense>
                </div>
              )
            })}

            {activeWidgets.length === 0 && (
              <div className="col-span-3 text-center text-gray-400 py-20">
                No widgets yet — click <strong>+ Add Widget</strong> to get started.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Widget Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader><CardTitle>Add Widget</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {allWidgets.map(widget => (
                <button
                  key={widget.id}
                  onClick={() => { dispatch(addWidget({ id: widget.id })); setShowModal(false) }}
                  disabled={activeWidgets.includes(widget.id)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <div className="font-medium text-sm">{widget.name}</div>
                  <div className="text-xs text-gray-500">{widget.description}</div>
                </button>
              ))}
              <Button variant="outline" className="w-full mt-2" onClick={() => setShowModal(false)}>Cancel</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
