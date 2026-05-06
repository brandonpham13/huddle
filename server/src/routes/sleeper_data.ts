import express, { type Express } from 'express';
import { getSleeperUser, getSleeperLeagues } from '../services/sleeperService.js';

export function initSleeperRoutes(app: Express) {
    const router = express.Router();

    /**
     * GET /api/sleeper/user/:username
     * Retrieves public Sleeper user profile info.
     */
    router.get('/sleeper/user/:username', async (req, res) => {
        const username = req.params.username;

        if (!username || !username.trim()) {
            res.status(400).json({ error: 'username parameter is required' });
            return;
        }

        try {
            const data = await getSleeperUser(username);

            if (!data) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            res.json({ user: data });
            return;

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            res.status(502).json({ error: 'Upstream Sleeper API error', message });
            return;
        }
    });

    router.get('/sleeper/user/:userId/leagues/:year', async (req, res) => {
        const userId = req.params.userId;
        const year = req.params.year;

        if (!userId || !userId.trim()) {
            res.status(400).json({ error: 'userId parameter is required' });
            return;
        }

        try {
            const data = await getSleeperLeagues(userId, year);
            res.json({ user: data });
            return;

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            res.status(502).json({ error: 'Upstream Sleeper API error', message });
            return;
        }
    });

    // Simple health check for this router
    router.get('/sleeper/health', (_req, res) => {
        res.json({ status: 'ok' });
    });

    app.use('/api', router);
}
