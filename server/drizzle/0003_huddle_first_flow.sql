-- Make league_provider and league_id nullable so huddles can exist before a league is linked.
-- Commissioners link a league later via PATCH /api/huddles/:id/league.
ALTER TABLE "huddles" ALTER COLUMN "league_provider" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "huddles" ALTER COLUMN "league_id" DROP NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "huddles_league_idx";
