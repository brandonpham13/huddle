import express, { type Express } from 'express'
import {
  getSleeperUser,
  getSleeperLeagues,
  getLeagueRosters,
  getLeagueUsers,
} from '../services/sleeperService.js'

export function initSleeperRoutes(app: Express) {
  const router = express.Router()

  router.get('/sleeper/user/:username', async (req, res) => {
    const { username } = req.params
    if (!username?.trim()) {
      res.status(400).json({ error: 'username is required' })
      return
    }
    try {
      const user = await getSleeperUser(username)
      if (!user) { res.status(404).json({ error: 'User not found' }); return }
      res.json({ user })
    } catch (err) {
      res.status(502).json({ error: 'Sleeper API error', message: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  router.get('/sleeper/user/:userId/leagues/:year', async (req, res) => {
    const { userId, year } = req.params
    if (!userId?.trim()) {
      res.status(400).json({ error: 'userId is required' })
      return
    }
    try {
      const leagues = await getSleeperLeagues(userId, year)
      res.json({ leagues })
    } catch (err) {
      res.status(502).json({ error: 'Sleeper API error', message: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  router.get('/sleeper/league/:leagueId/standings', async (req, res) => {
    const { leagueId } = req.params
    if (!leagueId?.trim()) {
      res.status(400).json({ error: 'leagueId is required' })
      return
    }
    try {
      const [rosters, users] = await Promise.all([
        getLeagueRosters(leagueId),
        getLeagueUsers(leagueId),
      ])
      const userMap = new Map(users.map(u => [u.user_id, u]))
      const standings = rosters.map(r => {
        const user = r.owner_id ? userMap.get(r.owner_id) : undefined
        const fptsWhole = r.settings?.fpts ?? 0
        const fptsDecimal = r.settings?.fpts_decimal ?? 0
        return {
          roster_id: r.roster_id,
          owner_id: r.owner_id,
          team_name: user?.metadata?.team_name?.trim() || user?.display_name || `Team ${r.roster_id}`,
          avatar: user?.avatar ?? null,
          wins: r.settings?.wins ?? 0,
          losses: r.settings?.losses ?? 0,
          ties: r.settings?.ties ?? 0,
          points_for: fptsWhole + fptsDecimal / 100,
        }
      })
      standings.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        return b.points_for - a.points_for
      })
      res.json({ standings })
    } catch (err) {
      res.status(502).json({ error: 'Sleeper API error', message: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  app.use('/api', router)
}
