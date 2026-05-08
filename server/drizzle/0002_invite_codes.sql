-- Drop password, add invite_code
ALTER TABLE "huddles" DROP COLUMN IF EXISTS "password_hash";--> statement-breakpoint
ALTER TABLE "huddles" ADD COLUMN IF NOT EXISTS "invite_code" text;--> statement-breakpoint
ALTER TABLE "huddles" ADD COLUMN IF NOT EXISTS "invite_code_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Backfill existing rows
UPDATE "huddles" SET "invite_code" = upper(substr(md5(random()::text || id::text), 1, 6)) WHERE "invite_code" IS NULL;--> statement-breakpoint
ALTER TABLE "huddles" ALTER COLUMN "invite_code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "huddles_invite_code_uniq" ON "huddles" USING btree ("invite_code");
