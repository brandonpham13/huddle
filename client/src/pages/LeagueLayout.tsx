/**
 * LeagueLayout — parent route for everything under "League".
 *
 * First sub-page here is the Forum; League itself stays the index route.
 * See `ScheduleLayout.tsx` for the tab-strip + Outlet pattern this mirrors.
 */
import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/league", label: "Overview", end: true },
  { to: "/league/forum", label: "Forum", end: false },
];

export function LeagueLayout() {
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
