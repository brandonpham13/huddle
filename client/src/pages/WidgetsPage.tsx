import { Suspense } from 'react'
import { Link } from 'react-router-dom'
import { getSecondaryWidgets, colSpanClass, rowSpanClass } from '../widgets/registry'
import { useAppSelector } from '../store/hooks'
import { Card, CardContent } from '../components/ui/card'

// Register all widgets so secondary ones are available
import '../widgets/LeagueStandings'
import '../widgets/RecentScoreboard'

export function WidgetsPage() {
  const selectedLeagueId = useAppSelector(state => state.auth.selectedLeagueId)
  const secondaryWidgets = getSecondaryWidgets()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">← Dashboard</Link>
        <h1 className="text-xl font-bold">Widgets</h1>
      </nav>

      <main className="p-6">
        {!selectedLeagueId && (
          <div className="text-center text-gray-400 py-20">
            <Link to="/leagues" className="text-blue-600 hover:underline">Sync a league</Link> to view widgets.
          </div>
        )}

        {selectedLeagueId && secondaryWidgets.length === 0 && (
          <div className="text-center text-gray-400 py-20">
            No additional widgets yet — check back soon.
          </div>
        )}

        {selectedLeagueId && secondaryWidgets.length > 0 && (
          <div className="grid grid-cols-12 gap-4 auto-rows-auto">
            {secondaryWidgets.map(def => {
              const WidgetComponent = def.component
              return (
                <div
                  key={def.id}
                  className={`${colSpanClass(def.defaultSize.w)} ${rowSpanClass(def.defaultSize.h)}`}
                >
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
          </div>
        )}
      </main>
    </div>
  )
}
