CREATE TYPE "public"."claim_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_provider" text NOT NULL,
	"league_id" text NOT NULL,
	"name" text NOT NULL,
	"commissioner_user_id" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"roster_id" integer NOT NULL,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text
);
--> statement-breakpoint
ALTER TABLE "team_claims" ADD CONSTRAINT "team_claims_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "groups_league_idx" ON "groups" USING btree ("league_provider","league_id");--> statement-breakpoint
CREATE INDEX "groups_commissioner_idx" ON "groups" USING btree ("commissioner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_claims_group_roster_approved_uniq" ON "team_claims" USING btree ("group_id","roster_id") WHERE "team_claims"."status" = 'approved';--> statement-breakpoint
CREATE UNIQUE INDEX "team_claims_group_user_approved_uniq" ON "team_claims" USING btree ("group_id","user_id") WHERE "team_claims"."status" = 'approved';--> statement-breakpoint
CREATE INDEX "team_claims_group_idx" ON "team_claims" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "team_claims_user_idx" ON "team_claims" USING btree ("user_id");