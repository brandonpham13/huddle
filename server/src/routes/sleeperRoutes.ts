import express, { type Express } from 'express'
import {
  getSleeperUser,
  getSleeperLeagues,
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getLeagueMatchups,
  getNFLPlayers,
  getNFLState,
  getLeagueTransactions,
  getTradedPicks,
  getWinnersBracket,
  getLosersBracket,
  getDraft,
  getDraftPicks,
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

  // GET /api/sleeper/user/:userId/leagues/all
  // Fetches every league the user has ever been in, across all seasons, in parallel.
  // Must be registered BEFORE /:year to prevent "all" matching the year param.
  router.get('/sleeper/user/:userId/leagues/all', async (req, res) => {
    const { userId } = req.params
    if (!userId?.trim()) {
      res.status(400).json({ error: 'userId is required' })
      return
    }
    try {
      const currentYear = new Date().getFullYear()
      const START_YEAR = 2017
      const years = Array.from({ length: currentYear - START_YEAR + 1 }, (_, i) => (START_YEAR + i).toString())
      const results = await Promise.allSettled(years.map(y => getSleeperLeagues(userId, y)))
      const seen = new Set<string>()
      const leagues = results
        .flatMap(r => (r.status === 'fulfilled' ? r.value : []))
        .filter(l => { if (seen.has(l.league_id)) return false; seen.add(l.league_id); return true })
        .sort((a, b) => Number(b.season) - Number(a.season) || a.name.localeCompare(a.name))
      res.json({ leagues })
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

  // GET /api/sleeper/league/:leagueId/history
  // Walks the previous_league_id chain to build a season history list, newest first.
  router.get('/sleeper/league/:leagueId/history', async (req, res) => {
    try {
      const history: Array<{ leagueId: string; season: string }> = []
      let currentId: string | null = req.params.leagueId
      let iterations = 0
      const MAX_DEPTH = 15
      while (currentId && iterations < MAX_DEPTH) {
        const league = await getLeague(currentId)
        history.push({ leagueId: league.league_id, season: league.season })
        const prevId = league.previous_league_id && league.previous_league_id !== '0'
          ? league.previous_league_id
          : null
        currentId = prevId
        iterations++
      }
      res.json({ history })
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

  // GET /api/sleeper/state/nfl
  router.get('/sleeper/state/nfl', async (_req, res) => {
    try {
      const state = await getNFLState()
      res.json({ state })
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  // GET /api/sleeper/league/:leagueId/transactions/:week
  router.get('/sleeper/league/:leagueId/transactions/:week', async (req, res) => {
    const week = parseInt(req.params.week, 10)
    if (isNaN(week) || week < 1 || week > 18) {
      res.status(400).json({ error: 'week must be between 1 and 18' }); return
    }
    try {
      const transactions = await getLeagueTransactions(req.params.leagueId, week)
      res.json({ transactions })
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  // GET /api/sleeper/league/:leagueId/traded_picks
  router.get('/sleeper/league/:leagueId/traded_picks', async (req, res) => {
    try {
      const picks = await getTradedPicks(req.params.leagueId)
      res.json({ picks })
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  // GET /api/sleeper/league/:leagueId/winners_bracket
  router.get('/sleeper/league/:leagueId/winners_bracket', async (req, res) => {
    try {
      const bracket = await getWinnersBracket(req.params.leagueId)
      res.json({ bracket })
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  // GET /api/sleeper/league/:leagueId/losers_bracket
  router.get('/sleeper/league/:leagueId/losers_bracket', async (req, res) => {
    try {
      const bracket = await getLosersBracket(req.params.leagueId)
      res.json({ bracket })
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  // GET /api/sleeper/draft/:draftId
  router.get('/sleeper/draft/:draftId', async (req, res) => {
    try {
      const draft = await getDraft(req.params.draftId)
      res.json({ draft })
    } catch (err) {
      const status = (err as { status?: number }).status === 404 ? 404 : 502
      res.status(status).json({ error: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  // GET /api/sleeper/draft/:draftId/picks
  router.get('/sleeper/draft/:draftId/picks', async (req, res) => {
    try {
      const picks = await getDraftPicks(req.params.draftId)
      res.json({ picks })
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Unknown' })
    }
  })

  app.use('/api', router)
}
