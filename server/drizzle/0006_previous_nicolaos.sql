ALTER TYPE "public"."poll_results_visibility" ADD VALUE 'after_close';--> statement-breakpoint
ALTER TABLE "huddle_polls" ADD COLUMN "closes_at" timestamp with time zone;