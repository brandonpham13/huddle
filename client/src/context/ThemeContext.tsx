/**
 * ThemeContext — light/dark mode state.
 *
 * Tailwind v4 dark mode is driven by a `.dark` class on an ancestor of the
 * styled tree. The provider applies that class to a wrapper `<div>` based
 * on the current `theme` state; CSS variables in `styles/index.css` swap
 * on the presence of `.dark`, so every `bg-paper` / `text-ink` / etc.
 * utility flips automatically.
 *
 * Initial value resolution order:
 *   1. `huddle-theme` in localStorage (if the user has flipped it before)
 *   2. Light mode (default — we don't follow the OS preference)
 *
 * Wired into the global provider stack in `providers/AppProviders.tsx`,
 * and the toggle is exposed in the top nav via AppShell.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("huddle-theme") as Theme | null;
    if (stored === "light" || stored === "dark") return stored;
    return "light";
  });

  useEffect(() => {
    localStorage.setItem("huddle-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <div className={theme === "dark" ? "dark" : ""}>{children}</div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
