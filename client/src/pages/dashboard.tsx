import React, { useState, Suspense } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { addWidget, removeWidget } from '../store/slices/widgetSlice';
import { getAllWidgets } from '../widgets/registry';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

// Register all widgets
import '../widgets/LeagueStandings/index';

export function Dashboard() {
  const dispatch = useDispatch();
  const activeWidgets = useSelector((state: RootState) => state.widget.activeWidgets);
  const [showAddModal, setShowAddModal] = useState(false);

  const allWidgets = getAllWidgets();

  const handleAddWidget = (widgetId: string) => {
    dispatch(addWidget({ id: widgetId }));
    setShowAddModal(false);
  };

  const handleRemoveWidget = (widgetId: string) => {
    dispatch(removeWidget(widgetId));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button onClick={() => setShowAddModal(true)}>+ Add Widget</Button>
      </div>

      {/* Widget grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeWidgets.map((widgetId) => {
          const widgetDef = allWidgets.find((w) => w.id === widgetId);
          if (!widgetDef) return null;
          const WidgetComponent = widgetDef.component;

          return (
            <div key={widgetId} className="relative">
              <button
                onClick={() => handleRemoveWidget(widgetId)}
                className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 text-xs"
                aria-label={`Remove ${widgetDef.name}`}
              >
                ✕
              </button>
              <Suspense
                fallback={
                  <Card>
                    <CardContent className="p-8 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
                    </CardContent>
                  </Card>
                }
              >
                <WidgetComponent />
              </Suspense>
            </div>
          );
        })}

        {activeWidgets.length === 0 && (
          <div className="col-span-3 text-center text-gray-400 py-16">
            No widgets added yet. Click &quot;+ Add Widget&quot; to get started.
          </div>
        )}
      </div>

      {/* Add widget modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Add Widget</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allWidgets.map((widget) => (
                  <button
                    key={widget.id}
                    onClick={() => handleAddWidget(widget.id)}
                    disabled={activeWidgets.includes(widget.id)}
                    className="w-full text-left p-3 rounded-md border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium">{widget.name}</div>
                    <div className="text-sm text-gray-500">{widget.description}</div>
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
