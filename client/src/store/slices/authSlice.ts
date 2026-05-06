import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface User {
  id: string
  username: string | null
  email: string
  sleeperUsername: string | null
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: true,
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
    },
    setSleeperUsername(state, action: PayloadAction<string | null>) {
      if (state.user) {
        state.user.sleeperUsername = action.payload
      }
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
  },
})

export const { setUser, clearUser, setSleeperUsername, setLoading } = authSlice.actions
export default authSlice.reducer
