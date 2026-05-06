import { type Express, type Request, type Response } from 'express'
import { getAuth, createClerkClient } from '@clerk/express'
import { requireAuth } from '../middleware/requireAuth.js'
import { getSleeperUser } from '../services/sleeperService.js'

const clerkSecretKey = process.env['CLERK_SECRET_KEY']
if (!clerkSecretKey) {
  throw new Error('Missing required environment variable: CLERK_SECRET_KEY')
}

const clerkClient = createClerkClient({ secretKey: clerkSecretKey })

export function initUserRoutes(app: Express) {
  // PATCH /api/user/sleeper-username — link or clear Sleeper username
  app.patch('/api/user/sleeper-username', requireAuth, async (req: Request, res: Response) => {
    const { sleeperUsername } = req.body as { sleeperUsername?: string | null }

    // Allow null/empty string to unlink
    const isUnlink = sleeperUsername === null || sleeperUsername === ''

    if (!isUnlink) {
      if (typeof sleeperUsername !== 'string' || !sleeperUsername.trim() || sleeperUsername.trim().length > 50) {
        res.status(400).json({ error: 'Invalid sleeperUsername' })
        return
      }
    }

    const username = isUnlink ? null : sleeperUsername!.trim()

    if (username) {
      try {
        const sleeperUser = await getSleeperUser(username)
        if (!sleeperUser) { res.status(404).json({ error: 'Sleeper user not found' }); return }
      } catch {
        res.status(502).json({ error: 'Failed to verify Sleeper user' })
        return
      }
    }

    const { userId } = getAuth(req)
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }

    try {
      await clerkClient.users.updateUserMetadata(userId, {
        unsafeMetadata: { sleeperUsername: username },
      })
    } catch {
      res.status(503).json({ error: 'Failed to update user metadata' })
      return
    }

    res.json({ sleeperUsername: username })
  })
}
