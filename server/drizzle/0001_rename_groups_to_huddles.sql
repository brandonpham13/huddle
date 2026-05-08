ALTER TABLE "groups" RENAME TO "huddles";--> statement-breakpoint
ALTER TABLE "team_claims" RENAME COLUMN "group_id" TO "huddle_id";--> statement-breakpoint
ALTER TABLE "team_claims" RENAME CONSTRAINT "team_claims_group_id_groups_id_fk" TO "team_claims_huddle_id_huddles_id_fk";--> statement-breakpoint
ALTER INDEX "groups_league_idx" RENAME TO "huddles_league_idx";--> statement-breakpoint
ALTER INDEX "groups_commissioner_idx" RENAME TO "huddles_commissioner_idx";--> statement-breakpoint
ALTER INDEX "team_claims_group_roster_approved_uniq" RENAME TO "team_claims_huddle_roster_approved_uniq";--> statement-breakpoint
ALTER INDEX "team_claims_group_user_approved_uniq" RENAME TO "team_claims_huddle_user_approved_uniq";--> statement-breakpoint
ALTER INDEX "team_claims_group_idx" RENAME TO "team_claims_huddle_idx";
