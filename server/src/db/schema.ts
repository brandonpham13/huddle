import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const claimStatus = pgEnum("claim_status", [
  "pending",
  "approved",
  "rejected",
]);

export const huddles = pgTable(
  "huddles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leagueProvider: text("league_provider").notNull(),
    leagueId: text("league_id").notNull(),
    name: text("name").notNull(),
    commissionerUserId: text("commissioner_user_id").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    byLeague: index("huddles_league_idx").on(t.leagueProvider, t.leagueId),
    byCommissioner: index("huddles_commissioner_idx").on(t.commissionerUserId),
  }),
);

export const teamClaims = pgTable(
  "team_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    rosterId: integer("roster_id").notNull(),
    status: claimStatus("status").notNull().default("pending"),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: text("decided_by"),
  },
  (t) => ({
    // One approved claim per (huddle, roster). Partial index allows multiple
    // pending or rejected claims on the same roster while only one becomes approved.
    uniqApprovedRoster: uniqueIndex("team_claims_huddle_roster_approved_uniq")
      .on(t.huddleId, t.rosterId)
      .where(sql`${t.status} = 'approved'`),
    // One approved claim per (huddle, user) — a user can only own one team in a huddle.
    uniqApprovedUser: uniqueIndex("team_claims_huddle_user_approved_uniq")
      .on(t.huddleId, t.userId)
      .where(sql`${t.status} = 'approved'`),
    byHuddle: index("team_claims_huddle_idx").on(t.huddleId),
    byUser: index("team_claims_user_idx").on(t.userId),
  }),
);

export type Huddle = typeof huddles.$inferSelect;
export type NewHuddle = typeof huddles.$inferInsert;
export type TeamClaim = typeof teamClaims.$inferSelect;
export type NewTeamClaim = typeof teamClaims.$inferInsert;
