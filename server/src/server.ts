import express from 'express'
import { clerkMiddleware } from '@clerk/express'
import { initProviderRoutes } from './routes/providerRoutes.js'
import { initUserRoutes } from './routes/userRoutes.js'

const app = express()
const PORT = process.env['PORT'] ? Number(process.env['PORT']) : 4000

app.use(express.json())
app.use(clerkMiddleware())

initProviderRoutes(app)
initUserRoutes(app)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
