import { type Request, type Response, type NextFunction } from 'express'

interface Bucket {
  count: number
  resetAt: number
}

/**
 * Tiny in-memory fixed-window rate limiter, keyed by IP. Single-instance only —
 * swap for a Redis-backed implementation when scaling horizontally.
 */
export function rateLimit(opts: { windowMs: number; max: number; key?: string }) {
  const buckets = new Map<string, Bucket>()
  const label = opts.key ?? 'rl'

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const k = `${label}:${ip}`
    const now = Date.now()
    let bucket = buckets.get(k)

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs }
      buckets.set(k, bucket)
    }

    bucket.count++
    if (bucket.count > opts.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
      res.setHeader('Retry-After', String(retryAfter))
      res.status(429).json({ error: 'Too many requests, please slow down' })
      return
    }

    next()
  }
}
