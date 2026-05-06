import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import widgetReducer from './slices/widgetSlice'
import leagueReducer from './slices/leagueSlice'

const WIDGET_STORAGE_KEY = 'fantasy-analytics:widget-state:v1'

function loadPersistedWidgetState() {
  try {
    const raw = localStorage.getItem(WIDGET_STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.activeWidgets) || typeof parsed.layout !== 'object') {
      return undefined
    }
    return parsed
  } catch {
    return undefined
  }
}

const persistedWidget = loadPersistedWidgetState()

export const store = configureStore({
  reducer: {
    auth: authReducer,
    widget: widgetReducer,
    league: leagueReducer,
  },
  preloadedState: persistedWidget ? { widget: persistedWidget } : undefined,
})

let lastWidgetState = store.getState().widget
store.subscribe(() => {
  const currentWidget = store.getState().widget
  if (currentWidget === lastWidgetState) return
  lastWidgetState = currentWidget
  try {
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(currentWidget))
  } catch {
    // localStorage unavailable or full — fail silently
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
