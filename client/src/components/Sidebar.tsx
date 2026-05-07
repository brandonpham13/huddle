import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Trophy,
  Calendar,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", to: "/", icon: Home, end: true },
  { label: "League", to: "/league", icon: Trophy, end: false },
  { label: "Schedule", to: "/schedule", icon: Calendar, end: false },
  { label: "Draft", to: "/draft", icon: ClipboardList, end: false },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`
        relative flex flex-col bg-white border-r shrink-0 transition-all duration-200
        ${collapsed ? "w-14" : "w-52"}
      `}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-6 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border text-gray-400 hover:text-gray-700 hover:border-gray-400 transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <nav className="flex flex-col gap-1 p-2 mt-2">
        {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }
              ${collapsed ? "justify-center" : ""}
              `
            }
          >
            <Icon size={16} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
