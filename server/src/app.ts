import express from 'express'
import { clerkMiddleware } from '@clerk/express'
import { initProviderRoutes } from './routes/providerRoutes.js'
import { initUserRoutes } from './routes/userRoutes.js'

export const app = express()

app.use(express.json())
app.use(clerkMiddleware())

initProviderRoutes(app)
initUserRoutes(app)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})
