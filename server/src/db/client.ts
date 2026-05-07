import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema.js'

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

let realDb: DrizzleDb | null = null

function getDb(): DrizzleDb {
  if (!realDb) {
    const url = process.env['DATABASE_URL']
    if (!url) {
      throw new Error('Missing required environment variable: DATABASE_URL')
    }
    realDb = drizzle(neon(url), { schema })
  }
  return realDb
}

// Lazy proxy: callers can `import { db } from '../db/client.js'` and use
// `db.select()` etc. as if it were a real Drizzle instance. The connection
// is only created on first use, so a missing DATABASE_URL no longer crashes
// the process at import time — it only fails the routes that actually need it.
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver)
  },
})

export { schema }
