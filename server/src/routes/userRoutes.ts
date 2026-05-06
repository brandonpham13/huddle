import { type Express, type Request, type Response } from 'express'
import { getAuth, createClerkClient } from '@clerk/express'
import { requireAuth } from '../middleware/requireAuth.js'
import { getSleeperUser } from '../services/sleeperService.js'

const clerkClient = createClerkClient({ secretKey: process.env['CLERK_SECRET_KEY'] })

export function initUserRoutes(app: Express) {
  app.patch('/api/user/sleeper-username', requireAuth, async (req: Request, res: Response) => {
    const { sleeperUsername } = req.body as { sleeperUsername?: string }

    if (!sleeperUsername || typeof sleeperUsername !== 'string' || !sleeperUsername.trim() || sleeperUsername.trim().length > 50) {
      res.status(400).json({ error: 'Invalid sleeperUsername' })
      return
    }

    const username = sleeperUsername.trim()

    try {
      const sleeperUser = await getSleeperUser(username)
      if (!sleeperUser) { res.status(404).json({ error: 'Sleeper user not found' }); return }
    } catch {
      res.status(502).json({ error: 'Failed to verify Sleeper user' })
      return
    }

    const { userId } = getAuth(req)
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }

    await clerkClient.users.updateUserMetadata(userId, {
      unsafeMetadata: { sleeperUsername: username },
    })

    res.json({ sleeperUsername: username })
  })
}
