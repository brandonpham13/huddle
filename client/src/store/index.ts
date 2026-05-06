import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import widgetReducer from './slices/widgetSlice'
import leagueReducer from './slices/leagueSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    widget: widgetReducer,
    league: leagueReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
