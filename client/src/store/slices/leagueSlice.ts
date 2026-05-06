import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface League {
  league_id: string
  name: string
  season: string
  status: string
  total_rosters: number
  sport: string
  avatar: string | null
}

interface LeagueState {
  selectedLeagueId: string | null
  leagues: League[]
}

const initialState: LeagueState = {
  selectedLeagueId: null,
  leagues: [],
}

const leagueSlice = createSlice({
  name: 'league',
  initialState,
  reducers: {
    setSelectedLeague(state, action: PayloadAction<string>) {
      state.selectedLeagueId = action.payload
    },
    setLeagues(state, action: PayloadAction<League[]>) {
      state.leagues = action.payload
    },
  },
})

export const { setSelectedLeague, setLeagues } = leagueSlice.actions
export default leagueSlice.reducer
