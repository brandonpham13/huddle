import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccountModal } from '../components/AccountModal'
import { useAppSelector } from '../store/hooks'
import { useAllSleeperLeagues, useSyncLeagues } from '../hooks/useSleeper'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import type { League } from '../types/fantasy'

function leagueStatusBadge(status: string) {
  const map: Record<string, string> = {
    in_season: 'bg-green-100 text-green-800',
    pre_draft: 'bg-yellow-100 text-yellow-800',
    drafting: 'bg-blue-100 text-blue-800',
    complete: 'bg-gray-100 text-gray-600',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

/**
 * Builds a map from leagueId -> root ancestor leagueId by following
 * the previousLeagueRef chain. Two leagues with the same root are in
 * the same "family" (i.e. the same recurring league across seasons).
 */
function buildFamilyRootMap(leagues: League[]): Map<string, string> {
  const parentMap = new Map<string, string>()
  for (const l of leagues) {
    if (l.previousLeagueRef) {
      parentMap.set(l.ref.leagueId, l.previousLeagueRef.leagueId)
    }
  }
  const cache = new Map<string, string>()
  function getRoot(id: string, visited = new Set<string>()): string {
    if (cache.has(id)) return cache.get(id)!
    if (visited.has(id)) return id
    visited.add(id)
    const parent = parentMap.get(id)
    const root = parent ? getRoot(parent, visited) : id
    cache.set(id, root)
    return root
  }
  const result = new Map<string, string>()
  for (const l of leagues) {
    result.set(l.ref.leagueId, getRoot(l.ref.leagueId))
  }
  return result
}

export function LeaguesPage() {
  const { open: openAccountModal } = useAccountModal()
  const sleeperUsername = useAppSelector(state => state.auth.user?.sleeperUsername)
  const syncedLeagueIds = useAppSelector(state => state.auth.user?.syncedLeagueIds ?? [])
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString())

  const { data: leagues, isLoading, isError } = useAllSleeperLeagues()
  const syncMutation = useSyncLeagues()

  const [pendingIds, setPendingIds] = useState<string[]>(syncedLeagueIds)

  // Available years derived from loaded leagues, newest first
  const availableYears = leagues
    ? [...new Set(leagues.map(l => l.season))].sort((a, b) => Number(b) - Number(a))
    : [selectedYear]

  // Only show leagues for the selected year
  const visibleLeagues = leagues?.filter(l => l.season === selectedYear) ?? []

  // Family root map: detect leagues already imported under a different year's ID
  const familyRootMap = leagues ? buildFamilyRootMap(leagues) : new Map<string, string>()
  const syncedRoots = new Set(pendingIds.map(id => familyRootMap.get(id) ?? id))

  // Deduplicated imported leagues: one representative per family (most recent season)
  const importedFamilies: { root: string; representative: League; allIds: string[] }[] = (() => {
    if (!leagues) return []
    const byRoot = new Map<string, string[]>()
    for (const id of pendingIds) {
      const root = familyRootMap.get(id) ?? id
      byRoot.set(root, [...(byRoot.get(root) ?? []), id])
    }
    return [...byRoot.entries()].map(([root, ids]) => {
      const members = ids
        .map(id => leagues.find(l => l.ref.leagueId === id))
        .filter((l): l is League => l !== undefined)
        .sort((a, b) => Number(b.season) - Number(a.season))
      return { root, representative: members[0], allIds: ids }
    }).filter(f => f.representative !== undefined)
  })()

  const removeFamily = (allIds: string[]) => {
    setPendingIds(prev => prev.filter(id => !allIds.includes(id)))
  }

  const addLeague = (leagueId: string) => {
    setPendingIds(prev => [...prev, leagueId])
  }

  const hasChanges = JSON.stringify([...pendingIds].sort()) !== JSON.stringify([...syncedLeagueIds].sort())

  const handleSave = () => {
    syncMutation.mutate(pendingIds)
  }

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
              <Button onClick={openAccountModal}>Go to Settings</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{selectedYear} Leagues</CardTitle>
                <CardDescription>
                  Select leagues to sync to your dashboard. Synced leagues appear in your league switcher.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Year selector */}
                <div className="flex flex-col items-center gap-2 mb-6">
                  <span className="text-sm text-gray-500">Retrieve leagues from:</span>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(e.target.value)}
                    className="text-sm border rounded-md px-3 py-1.5 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    {availableYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {isLoading && (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
                  </div>
                )}

                {isError && (
                  <p className="text-sm text-red-500">Failed to load leagues. Check that your Sleeper username is correct.</p>
                )}

                {!isLoading && visibleLeagues.length === 0 && (
                  <p className="text-sm text-gray-500">No leagues found for {sleeperUsername} in {selectedYear}.</p>
                )}

                {visibleLeagues.length > 0 && (
                  <div className="space-y-2">
                    {visibleLeagues.map(league => {
                      const leagueId = league.ref.leagueId
                      const isSynced = pendingIds.includes(leagueId)
                      const root = familyRootMap.get(leagueId) ?? leagueId
                      // Blocked if a different year's version of this league is already synced
                      const isImportedElsewhere = !isSynced && syncedRoots.has(root)

                      return (
                        <div
                          key={leagueId}
                          className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                            isSynced || isImportedElsewhere
                              ? 'bg-blue-50 border-blue-200'
                              : 'bg-white'
                          }`}
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
                                <span className="text-xs text-gray-400">{league.totalRosters} teams</span>
                              </div>
                            </div>
                          </div>

                          {/* Action area */}
                          {isSynced || isImportedElsewhere ? (
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">Imported</span>
                          ) : (
                            <button
                              onClick={() => addLeague(leagueId)}
                              className="text-xs font-medium px-3 py-1.5 rounded-md border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                            >
                              Import
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {visibleLeagues.length > 0 && (
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
            {/* Imported Leagues */}
            {importedFamilies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Imported Leagues</CardTitle>
                  <CardDescription>These leagues are synced to your dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {importedFamilies.map(({ representative: league, allIds }) => (
                      <div
                        key={allIds.join(',')}
                        className="flex items-center justify-between p-4 rounded-lg border bg-white"
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
                            <p className="text-xs text-gray-400 mt-0.5">
                              {allIds.length > 1 ? `${allIds.length} seasons imported` : league.season}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFamily(allIds)}
                          className="text-xs font-medium px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
