import { type Express, type Request, type Response } from 'express'
import { getAuth, createClerkClient } from '@clerk/express'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  GroupsServiceError,
  createGroup,
  decideClaim,
  deleteGroup,
  getGroup,
  listClaimsForGroup,
  listGroupsForLeague,
  submitClaim,
  updateGroup,
} from '../services/groupsService.js'

const clerkSecretKey = process.env['CLERK_SECRET_KEY']
if (!clerkSecretKey) {
  throw new Error('Missing required environment variable: CLERK_SECRET_KEY')
}
const clerkClient = createClerkClient({ secretKey: clerkSecretKey })

interface ClerkUserSummary {
  id: string
  username: string | null
  email: string | null
}

async function fetchUserSummaries(userIds: string[]): Promise<Map<string, ClerkUserSummary>> {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const result = new Map<string, ClerkUserSummary>()
  // Clerk SDK supports getUserList with userId filter (up to 500 ids)
  const list = await clerkClient.users.getUserList({ userId: unique, limit: unique.length })
  for (const u of list.data) {
    result.set(u.id, {
      id: u.id,
      username: u.username,
      email: u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? null,
    })
  }
  return result
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof GroupsServiceError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  console.error('groupRoutes error:', err)
  res.status(500).json({ error: 'Internal error' })
}

export function initGroupRoutes(app: Express) {
  // POST /api/groups — create a group for a league
  app.post('/api/groups', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req)
      const { leagueProvider, leagueId, name, password, rosterId } = req.body as {
        leagueProvider?: string
        leagueId?: string
        name?: string
        password?: string
        rosterId?: number | null
      }
      if (typeof leagueProvider !== 'string' || !leagueProvider) {
        res.status(400).json({ error: 'leagueProvider required' }); return
      }
      if (typeof leagueId !== 'string' || !leagueId) {
        res.status(400).json({ error: 'leagueId required' }); return
      }
      const group = await createGroup({
        leagueProvider,
        leagueId,
        name,
        password,
        rosterId: rosterId ?? null,
        commissionerUserId: userId!,
      })
      res.status(201).json({ group: serializeGroup(group) })
    } catch (err) {
      handleError(err, res)
    }
  })

  // GET /api/groups?leagueProvider=sleeper&leagueId=123 — list groups for a league
  app.get('/api/groups', requireAuth, async (req: Request, res: Response) => {
    try {
      const leagueProvider = req.query['leagueProvider']
      const leagueId = req.query['leagueId']
      if (typeof leagueProvider !== 'string' || typeof leagueId !== 'string') {
        res.status(400).json({ error: 'leagueProvider and leagueId query params required' }); return
      }
      const list = await listGroupsForLeague(leagueProvider, leagueId)
      res.json({ groups: list.map(serializeGroup) })
    } catch (err) {
      handleError(err, res)
    }
  })

  // GET /api/groups/:id — group detail with claim summary
  app.get('/api/groups/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req)
      const groupId = req.params.id!
      const group = await getGroup(groupId)
      if (!group) { res.status(404).json({ error: 'Group not found' }); return }

      const claims = await listClaimsForGroup(groupId)
      const isCommissioner = group.commissionerUserId === userId

      const claimerIds = [
        group.commissionerUserId,
        ...claims.map(c => c.userId),
      ]
      const userMap = await fetchUserSummaries(claimerIds)

      const myClaim = claims.find(c => c.userId === userId) ?? null

      res.json({
        group: {
          ...serializeGroup(group),
          commissioner: userMap.get(group.commissionerUserId) ?? { id: group.commissionerUserId, username: null, email: null },
          isCommissioner,
        },
        claims: claims.map(c => ({
          id: c.id,
          rosterId: c.rosterId,
          status: c.status,
          message: c.message,
          createdAt: c.createdAt,
          decidedAt: c.decidedAt,
          // Only commissioners see other users' identities; self always visible.
          user: (isCommissioner || c.userId === userId)
            ? userMap.get(c.userId) ?? { id: c.userId, username: null, email: null }
            : null,
        })),
        myClaim: myClaim ? { id: myClaim.id, rosterId: myClaim.rosterId, status: myClaim.status } : null,
      })
    } catch (err) {
      handleError(err, res)
    }
  })

  // POST /api/groups/:id/claims — submit a team claim with the group password
  app.post('/api/groups/:id/claims', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req)
      const { password, rosterId, message } = req.body as {
        password?: string
        rosterId?: number
        message?: string
      }
      const claim = await submitClaim({
        groupId: req.params.id!,
        userId: userId!,
        password,
        rosterId,
        message,
      })
      res.status(201).json({ claim: serializeClaim(claim) })
    } catch (err) {
      handleError(err, res)
    }
  })

  // GET /api/groups/:id/claims — commissioner-only pending list with claimer identities
  app.get('/api/groups/:id/claims', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req)
      const groupId = req.params.id!
      const group = await getGroup(groupId)
      if (!group) { res.status(404).json({ error: 'Group not found' }); return }
      if (group.commissionerUserId !== userId) {
        res.status(403).json({ error: 'Only the commissioner can list claims' }); return
      }
      const claims = await listClaimsForGroup(groupId)
      const userMap = await fetchUserSummaries(claims.map(c => c.userId))
      res.json({
        claims: claims.map(c => ({
          ...serializeClaim(c),
          user: userMap.get(c.userId) ?? { id: c.userId, username: null, email: null },
        })),
      })
    } catch (err) {
      handleError(err, res)
    }
  })

  // POST /api/groups/:id/claims/:claimId/decide — commissioner approves/rejects
  app.post('/api/groups/:id/claims/:claimId/decide', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req)
      const { decision } = req.body as { decision?: string }
      if (decision !== 'approved' && decision !== 'rejected') {
        res.status(400).json({ error: 'decision must be "approved" or "rejected"' }); return
      }
      const claim = await decideClaim({
        groupId: req.params.id!,
        claimId: req.params.claimId!,
        decision,
        decidedBy: userId!,
      })
      res.json({ claim: serializeClaim(claim) })
    } catch (err) {
      handleError(err, res)
    }
  })

  // PATCH /api/groups/:id — commissioner edits name and/or rotates password
  app.patch('/api/groups/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req)
      const { name, password } = req.body as { name?: string; password?: string }
      const group = await updateGroup({
        groupId: req.params.id!,
        userId: userId!,
        name,
        password,
      })
      res.json({ group: serializeGroup(group) })
    } catch (err) {
      handleError(err, res)
    }
  })

  // DELETE /api/groups/:id — commissioner deletes group (cascades claims)
  app.delete('/api/groups/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req)
      await deleteGroup({ groupId: req.params.id!, userId: userId! })
      res.status(204).end()
    } catch (err) {
      handleError(err, res)
    }
  })
}

function serializeGroup(g: { id: string; leagueProvider: string; leagueId: string; name: string; commissionerUserId: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: g.id,
    leagueProvider: g.leagueProvider,
    leagueId: g.leagueId,
    name: g.name,
    commissionerUserId: g.commissionerUserId,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  }
}

function serializeClaim(c: { id: string; groupId: string; rosterId: number; status: string; message: string | null; createdAt: Date; decidedAt: Date | null; userId: string }) {
  return {
    id: c.id,
    groupId: c.groupId,
    rosterId: c.rosterId,
    status: c.status,
    message: c.message,
    userId: c.userId,
    createdAt: c.createdAt,
    decidedAt: c.decidedAt,
  }
}
