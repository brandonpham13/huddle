-- ⚠️  BASELINE — DO NOT RUN AGAINST AN EXISTING DATABASE.
--
-- This file is a snapshot of the full schema as of 2026-07-21, generated to
-- re-sync drizzle-kit's meta/ bookkeeping. The production database already
-- contains every object below; running this there will fail on the first
-- CREATE TYPE.
--
-- It exists so `db:generate` can compute correct incremental diffs again.
-- Only run it when provisioning a brand-new, empty database.
--
-- The hand-written migrations that actually built production are kept in
-- ./archive/ for historical reference. See PLAYBOOK.md → "Database changes".

CREATE TYPE "public"."claim_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."side_bet_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled', 'settled');--> statement-breakpoint
CREATE TABLE "huddle_active_trophies" (
	"huddle_id" uuid NOT NULL,
	"trophy_type" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "huddle_active_trophies_huddle_id_trophy_type_pk" PRIMARY KEY("huddle_id","trophy_type")
);
--> statement-breakpoint
CREATE TABLE "huddle_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"huddle_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huddle_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"huddle_id" uuid NOT NULL,
	"roster_id" integer NOT NULL,
	"glyph" text NOT NULL,
	"color" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"granted_by" text NOT NULL,
	"season" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huddle_commissioners" (
	"huddle_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" text NOT NULL,
	CONSTRAINT "huddle_commissioners_huddle_id_user_id_pk" PRIMARY KEY("huddle_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "huddle_dues_config" (
	"huddle_id" uuid PRIMARY KEY NOT NULL,
	"amount" integer NOT NULL,
	"season" text,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huddle_dues_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"huddle_id" uuid NOT NULL,
	"roster_id" integer NOT NULL,
	"paid_at" timestamp with time zone,
	"marked_by" text NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huddle_payout_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"huddle_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huddles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_provider" text,
	"league_id" text,
	"name" text NOT NULL,
	"invite_code" text NOT NULL,
	"invite_code_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "side_bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"huddle_id" uuid NOT NULL,
	"proposer_id" text NOT NULL,
	"opponent_id" text NOT NULL,
	"proposer_roster_id" integer,
	"opponent_roster_id" integer,
	"week" integer NOT NULL,
	"season" text NOT NULL,
	"description" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"status" "side_bet_status" DEFAULT 'pending' NOT NULL,
	"winner_id" text,
	"settlement_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"huddle_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"roster_id" integer NOT NULL,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text
);
--> statement-breakpoint
ALTER TABLE "huddle_active_trophies" ADD CONSTRAINT "huddle_active_trophies_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_announcements" ADD CONSTRAINT "huddle_announcements_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_awards" ADD CONSTRAINT "huddle_awards_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_commissioners" ADD CONSTRAINT "huddle_commissioners_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_dues_config" ADD CONSTRAINT "huddle_dues_config_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_dues_payments" ADD CONSTRAINT "huddle_dues_payments_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_payout_entries" ADD CONSTRAINT "huddle_payout_entries_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_bets" ADD CONSTRAINT "side_bets_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_claims" ADD CONSTRAINT "team_claims_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "huddle_announcements_huddle_idx" ON "huddle_announcements" USING btree ("huddle_id");--> statement-breakpoint
CREATE INDEX "huddle_awards_huddle_idx" ON "huddle_awards" USING btree ("huddle_id");--> statement-breakpoint
CREATE INDEX "huddle_awards_huddle_roster_idx" ON "huddle_awards" USING btree ("huddle_id","roster_id");--> statement-breakpoint
CREATE INDEX "huddle_commissioners_user_idx" ON "huddle_commissioners" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "huddle_dues_payments_huddle_roster_uniq" ON "huddle_dues_payments" USING btree ("huddle_id","roster_id");--> statement-breakpoint
CREATE INDEX "huddle_payout_entries_huddle_idx" ON "huddle_payout_entries" USING btree ("huddle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "huddles_invite_code_uniq" ON "huddles" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "side_bets_huddle_idx" ON "side_bets" USING btree ("huddle_id");--> statement-breakpoint
CREATE INDEX "side_bets_proposer_idx" ON "side_bets" USING btree ("huddle_id","proposer_id");--> statement-breakpoint
CREATE INDEX "side_bets_opponent_idx" ON "side_bets" USING btree ("huddle_id","opponent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_claims_huddle_roster_approved_uniq" ON "team_claims" USING btree ("huddle_id","roster_id") WHERE "team_claims"."status" = 'approved';--> statement-breakpoint
CREATE UNIQUE INDEX "team_claims_huddle_user_approved_uniq" ON "team_claims" USING btree ("huddle_id","user_id") WHERE "team_claims"."status" = 'approved';--> statement-breakpoint
CREATE INDEX "team_claims_huddle_idx" ON "team_claims" USING btree ("huddle_id");--> statement-breakpoint
CREATE INDEX "team_claims_user_idx" ON "team_claims" USING btree ("user_id");