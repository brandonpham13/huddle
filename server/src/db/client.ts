import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema.js'

const databaseUrl = process.env['DATABASE_URL']
if (!databaseUrl) {
  throw new Error('Missing required environment variable: DATABASE_URL')
}

const sqlClient = neon(databaseUrl)
export const db = drizzle(sqlClient, { schema })
export { schema }
