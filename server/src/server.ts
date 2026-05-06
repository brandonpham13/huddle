import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import { initSleeperRoutes } from './routes/sleeper_data.js';

const app = express();
const PORT = process.env["PORT"] ? Number(process.env["PORT"]) : 4000;

// Basic middleware
app.use(express.json());

// Clerk auth middleware
app.use(clerkMiddleware());

// Initialize routes
initSleeperRoutes(app);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'fantasy-analytics-server' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
