import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface WidgetLayout {
  x: number
  y: number
  w: number
  h: number
}

interface WidgetState {
  activeWidgets: string[]
  layout: Record<string, WidgetLayout>
}

const initialState: WidgetState = {
  activeWidgets: [],
  layout: {},
}

const widgetSlice = createSlice({
  name: 'widget',
  initialState,
  reducers: {
    addWidget(state, action: PayloadAction<{ id: string; layout?: WidgetLayout }>) {
      if (!state.activeWidgets.includes(action.payload.id)) {
        state.activeWidgets.push(action.payload.id)
        if (action.payload.layout) {
          state.layout[action.payload.id] = action.payload.layout
        }
      }
    },
    removeWidget(state, action: PayloadAction<string>) {
      state.activeWidgets = state.activeWidgets.filter(id => id !== action.payload)
      delete state.layout[action.payload]
    },
    updateLayout(state, action: PayloadAction<{ id: string; layout: WidgetLayout }>) {
      state.layout[action.payload.id] = action.payload.layout
    },
  },
})

export const { addWidget, removeWidget, updateLayout } = widgetSlice.actions
export default widgetSlice.reducer
