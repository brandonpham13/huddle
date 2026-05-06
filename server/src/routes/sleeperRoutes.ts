import express, { type Express } from 'express'
import {
  getSleeperUser,
  getSleeperLeagues,
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getLeagueMatchups,
  getNFLPlayers,
} from '../services/sleeperService.js'

export function initSleeperRoutes(app: Express) {
  const router = express.Router()

  // GET /api/sleeper/user/:username
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

  // GET /api/sleeper/user/:userId/leagues/:year
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

  // GET /api/sleeper/league/:leagueId
  router.get('/sleeper/league/:leagueId', async (req, res) => {
    try {
      const league = await getLeague(req.params.leagueId)
      res.json({ league })
    } catch (err) {
      const status = (err as { status?: number }).status === 404 ? 404 : 502
      res.status(status).json({ error: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  // GET /api/sleeper/league/:leagueId/rosters
  router.get('/sleeper/league/:leagueId/rosters', async (req, res) => {
    try {
      const rosters = await getLeagueRosters(req.params.leagueId)
      res.json({ rosters })
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  // GET /api/sleeper/league/:leagueId/users
  router.get('/sleeper/league/:leagueId/users', async (req, res) => {
    try {
      const users = await getLeagueUsers(req.params.leagueId)
      res.json({ users })
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  // GET /api/sleeper/league/:leagueId/matchups/:week
  router.get('/sleeper/league/:leagueId/matchups/:week', async (req, res) => {
    const week = parseInt(req.params.week, 10)
    if (isNaN(week) || week < 1 || week > 18) {
      res.status(400).json({ error: 'week must be between 1 and 18' })
      return
    }
    try {
      const matchups = await getLeagueMatchups(req.params.leagueId, week)
      res.json({ matchups })
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  // GET /api/sleeper/players — returns cached NFL player dictionary
  router.get('/sleeper/players', async (_req, res) => {
    try {
      const players = await getNFLPlayers()
      res.json({ players })
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  app.use('/api', router)
}
