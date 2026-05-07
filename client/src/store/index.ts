import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import leagueReducer from './slices/leagueSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    league: leagueReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
