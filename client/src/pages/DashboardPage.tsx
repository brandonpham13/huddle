import { useState, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { useSignOut } from '../hooks/useSignOut'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { addWidget, removeWidget } from '../store/slices/widgetSlice'
import { getAllWidgets } from '../widgets/registry'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'

// Register widgets
import '../widgets/LeagueStandings'

export function DashboardPage() {
  const dispatch = useAppDispatch()
  const activeWidgets = useAppSelector(state => state.widget.activeWidgets)
  const [showModal, setShowModal] = useState(false)
  const { signOut } = useSignOut()
  const allWidgets = getAllWidgets()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Fantasy Analytics</h1>
        <div className="flex items-center gap-4">
          <Link to="/settings" className="text-sm text-gray-600 hover:text-gray-900">Settings</Link>
          <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </nav>

      {/* Dashboard */}
      <main className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <Button onClick={() => setShowModal(true)}>+ Add Widget</Button>
        </div>

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
      </main>

      {/* Add Widget Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Add Widget</CardTitle>
            </CardHeader>
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
              <Button variant="outline" className="w-full mt-2" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
