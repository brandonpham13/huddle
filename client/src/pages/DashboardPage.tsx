import { Suspense } from "react";
import { Link } from "react-router-dom";
import { useDashboardData } from "../widgets/dashboard/useDashboardData";
import { Ticker } from "../widgets/dashboard/chrome/Ticker";
import { Masthead } from "../widgets/dashboard/chrome/Masthead";
// Side-effect import: registers all dashboard widgets.
import "../widgets/dashboard";
import {
  colSpanClass,
  getDashboardWidgets,
  rowSpanClass,
} from "../widgets/registry";

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center font-serif italic text-muted text-lg">
        <Link to="/leagues" className="text-accent hover:underline">
          Sync a league
        </Link>{" "}
        to get started.
      </div>
    </div>
  );
}

function WidgetFallback() {
  return (
    <div className="flex justify-center py-6">
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-ink/40" />
    </div>
  );
}

export function DashboardPage() {
  const { hasLeague } = useDashboardData();
  const widgets = getDashboardWidgets();

  return (
    <div className="min-h-full bg-paper text-ink font-sans flex flex-col">
      {!hasLeague ? (
        <EmptyState />
      ) : (
        <>
          <Ticker />
          <Masthead />

          <div className="px-3 sm:px-7 pt-4 pb-6 flex-1">
            <div className="grid grid-cols-12 gap-x-6 gap-y-4">
              {widgets.map((w) => {
                const Component = w.component;
                return (
                  <div
                    key={w.id}
                    className={`${colSpanClass(w.defaultSize.w)} ${rowSpanClass(w.defaultSize.h)}`}
                  >
                    <Suspense fallback={<WidgetFallback />}>
                      <Component />
                    </Suspense>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
