/**
 * ScheduleLayout — parent route for everything under "Schedule".
 *
 * This is the first place in the app that nests routes one level under a
 * top-nav Sidebar item (see `Sidebar.tsx`'s single "Schedule" entry). The
 * Sidebar still links to `/schedule` only; sub-pages are surfaced as an
 * in-page tab strip here, the same visual idiom `SideBetsPage.tsx` already
 * uses for its filter tabs, just wired to real routes via `NavLink` +
 * `Outlet` instead of local state. Reuse this shape for any future
 * multi-page section instead of inventing a new one.
 */
import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/schedule", label: "Season Schedule", end: true },
  { to: "/schedule/generator", label: "Schedule Generator", end: false },
];

export function ScheduleLayout() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 sm:px-7 pt-4 border-b border-line">
        <div className="flex gap-1">
          {TABS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `px-3 py-1.5 text-xs font-medium font-sans rounded-t-md transition-colors
                ${isActive ? "text-ink border-b-2 border-ink -mb-px" : "text-muted hover:text-ink"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
