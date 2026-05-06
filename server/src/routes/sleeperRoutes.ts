import express, { type Express } from 'express'
import { getSleeperUser, getSleeperLeagues } from '../services/sleeperService.js'

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

  app.use('/api', router)
}
