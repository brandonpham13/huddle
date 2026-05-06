import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface User {
  id: string
  username: string | null
  email: string
  sleeperUsername: string | null
  sleeperUserId: string | null
  syncedLeagueIds: string[]
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  selectedLeagueId: string | null
  selectedYear: string
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: true,
  selectedLeagueId: null,
  selectedYear: new Date().getFullYear().toString(),
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload
      state.isAuthenticated = true
      state.loading = false
    },
    clearUser(state) {
      state.user = null
      state.isAuthenticated = false
      state.loading = false
      state.selectedLeagueId = null
    },
    setSleeperUsername(state, action: PayloadAction<string | null>) {
      if (state.user) state.user.sleeperUsername = action.payload
    },
    setSleeperUserId(state, action: PayloadAction<string | null>) {
      if (state.user) state.user.sleeperUserId = action.payload
    },
    setSyncedLeagueIds(state, action: PayloadAction<string[]>) {
      if (state.user) state.user.syncedLeagueIds = action.payload
    },
    setSelectedLeague(state, action: PayloadAction<string | null>) {
      state.selectedLeagueId = action.payload
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
  },
})

export const {
  setUser,
  clearUser,
  setSleeperUsername,
  setSleeperUserId,
  setSyncedLeagueIds,
  setSelectedLeague,
  setLoading,
} = authSlice.actions
export default authSlice.reducer
