-- Add 'revoked' to claim_status enum
ALTER TYPE "public"."claim_status" ADD VALUE IF NOT EXISTS 'revoked';--> statement-breakpoint

-- Replace password_hash with invite_code
ALTER TABLE "groups" DROP COLUMN IF EXISTS "password_hash";--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "invite_code" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "invite_code_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint

-- Backfill invite codes for existing rows
UPDATE "groups" SET "invite_code" = upper(substr(md5(random()::text || id::text), 1, 6)) WHERE "invite_code" IS NULL;--> statement-breakpoint

-- Make invite_code NOT NULL and add unique index
ALTER TABLE "groups" ALTER COLUMN "invite_code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "groups_invite_code_uniq" ON "groups" USING btree ("invite_code");
