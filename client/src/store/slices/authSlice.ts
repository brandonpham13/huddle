import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

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
