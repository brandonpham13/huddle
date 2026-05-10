/**
 * `auth` slice — the single source of truth for "who is signed in and
 * what are they currently looking at" across the app.
 *
 * Source of data:
 *   - `user.*`            ← mirrored from Clerk (`unsafeMetadata`) by
 *                            `AuthGuard` on every Clerk user update
 *   - `selectedLeagueId`  ← set by the league dropdown in AppShell;
 *                            persisted to localStorage by store/index.ts
 *   - `selectedYear`      ← set alongside selectedLeagueId so /leagues knows
 *                            which season's leagues to fetch
 *
 * Anything that needs to react synchronously to these values (sidebar,
 * dashboard, route guards) reads them with `useAppSelector`. Async
 * dependent data is fetched separately through TanStack Query hooks.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Shape mirroring Clerk's user + the extra Sleeper bits we store on it. */
interface User {
  id: string;
  username: string | null;
  email: string;
  sleeperUsername: string | null;
  sleeperUserId: string | null;
  syncedLeagueIds: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  selectedLeagueId: string | null;
  /** Year tied to selectedLeagueId. Used for fetching season-scoped data. */
  selectedYear: string;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  selectedLeagueId: null,
  selectedYear: new Date().getFullYear().toString(),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearUser(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.selectedLeagueId = null;
    },
    setSyncedLeagueIds(state, action: PayloadAction<string[]>) {
      if (state.user) state.user.syncedLeagueIds = action.payload;
    },
    setSelectedLeague(state, action: PayloadAction<string | null>) {
      state.selectedLeagueId = action.payload;
    },
    setSelectedYear(state, action: PayloadAction<string>) {
      state.selectedYear = action.payload;
    },
  },
});

export const {
  setUser,
  clearUser,
  setSyncedLeagueIds,
  setSelectedLeague,
  setSelectedYear,
} = authSlice.actions;
export default authSlice.reducer;
