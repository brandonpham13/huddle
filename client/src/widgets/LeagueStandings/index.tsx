import { lazy } from 'react'
import { registerWidget } from '../registry'

registerWidget({
  id: 'league-standings',
  name: 'League Standings',
  description: 'Your Sleeper leagues for the current season',
  component: lazy(() => import('./LeagueStandingsWidget')),
  defaultSize: { w: 4, h: 3 },
  tags: ['sleeper', 'leagues'],
})
