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
  primaryKey,
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
    leagueProvider: text("league_provider"),
    leagueId: text("league_id"),
    name: text("name").notNull(),
    inviteCode: text("invite_code").notNull(),
    inviteCodeUpdatedAt: timestamp("invite_code_updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    uniqInviteCode: uniqueIndex("huddles_invite_code_uniq").on(t.inviteCode),
  }),
);

// Many-to-many: a huddle can have multiple commissioners (co-commish support)
export const huddleCommissioners = pgTable(
  "huddle_commissioners",
  {
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    addedBy: text("added_by").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.huddleId, t.userId] }),
    byUser: index("huddle_commissioners_user_idx").on(t.userId),
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
    uniqApprovedRoster: uniqueIndex("team_claims_huddle_roster_approved_uniq")
      .on(t.huddleId, t.rosterId)
      .where(sql`${t.status} = 'approved'`),
    uniqApprovedUser: uniqueIndex("team_claims_huddle_user_approved_uniq")
      .on(t.huddleId, t.userId)
      .where(sql`${t.status} = 'approved'`),
    byHuddle: index("team_claims_huddle_idx").on(t.huddleId),
    byUser: index("team_claims_user_idx").on(t.userId),
  }),
);

export type Huddle = typeof huddles.$inferSelect;
export type NewHuddle = typeof huddles.$inferInsert;
export type HuddleCommissioner = typeof huddleCommissioners.$inferSelect;
export type TeamClaim = typeof teamClaims.$inferSelect;
export type NewTeamClaim = typeof teamClaims.$inferInsert;

// ── Payout structure ─────────────────────────────────────────────────────────

export const huddlePayoutEntries = pgTable(
  "huddle_payout_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    huddleId: uuid("huddle_id")
      .notNull()
      .references(() => huddles.id, { onDelete: "cascade" }),
    /** Human-readable label, e.g. "1st Place", "Most Points". */
    label: text("label").notNull(),
    /** Amount in cents (e.g. 5000 = $50.00). */
    amount: integer("amount").notNull().default(0),
    /** Display order (lower = shown first). */
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    byHuddle: index("huddle_payout_entries_huddle_idx").on(t.huddleId),
  }),
);

export type HuddlePayoutEntry = typeof huddlePayoutEntries.$inferSelect;
export type NewHuddlePayoutEntry = typeof huddlePayoutEntries.$inferInsert;
