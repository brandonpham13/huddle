/**
 * Applies any pending migrations in server/drizzle/ to whatever DATABASE_URL
 * is in the environment, using Drizzle's own migration tracker
 * (drizzle.__drizzle_migrations) so it only runs files that haven't been
 * applied to *this* database yet.
 *
 * Usage: DATABASE_URL=... node scripts/migrate.mjs
 * (see package.json's db:migrate / db:migrate:prod for the wired-up commands)
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Missing DATABASE_URL");

const sql = neon(url);
const db = drizzle(sql);

async function countApplied() {
  try {
    const rows = await sql.query("select count(*)::int as n from drizzle.__drizzle_migrations");
    return rows[0]?.n ?? 0;
  } catch {
    return 0; // tracking table doesn't exist yet
  }
}

const before = await countApplied();
await migrate(db, { migrationsFolder: join(__dirname, "..", "drizzle") });
const after = await countApplied();

if (after > before) {
  console.log(`Applied ${after - before} new migration(s). Total tracked: ${after}.`);
} else {
  console.log(`Already up to date. ${after} migration(s) tracked.`);
}
