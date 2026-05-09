import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";

const STORAGE_KEY = "huddle:selection";

interface PersistedSelection {
  selectedLeagueId: string | null;
  selectedYear?: string;
}

function loadPersistedSelection(): PersistedSelection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { selectedLeagueId: null };
    const parsed = JSON.parse(raw) as PersistedSelection;
    return {
      selectedLeagueId: parsed.selectedLeagueId ?? null,
      selectedYear: parsed.selectedYear,
    };
  } catch {
    return { selectedLeagueId: null };
  }
}

const persisted = loadPersistedSelection();

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  preloadedState: {
    auth: {
      user: null,
      isAuthenticated: false,
      selectedLeagueId: persisted.selectedLeagueId,
      selectedYear:
        persisted.selectedYear ?? new Date().getFullYear().toString(),
    },
  },
});

let lastPersisted = JSON.stringify({
  selectedLeagueId: persisted.selectedLeagueId,
  selectedYear: persisted.selectedYear,
});
store.subscribe(() => {
  const { selectedLeagueId, selectedYear } = store.getState().auth;
  const next = JSON.stringify({ selectedLeagueId, selectedYear });
  if (next === lastPersisted) return;
  lastPersisted = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // localStorage may be unavailable (private mode, quota); selection just
    // won't survive refresh in that case.
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
