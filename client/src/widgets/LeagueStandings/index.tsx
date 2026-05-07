import { lazy } from 'react'
import { registerWidget } from '../registry'

registerWidget({
  id: 'league-standings',
  name: 'League Standings',
  description: 'Current standings for your league',
  component: lazy(() => import('./LeagueStandingsWidget')),
  defaultSize: { w: 4, h: 1 },
  tags: ['sleeper', 'leagues'],
  showOnDashboard: true,
})
