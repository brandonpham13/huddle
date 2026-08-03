ALTER TABLE "huddles" ADD COLUMN "invite_link_token" text;--> statement-breakpoint
ALTER TABLE "huddles" ADD COLUMN "invite_link_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "huddles_invite_link_token_uniq" ON "huddles" USING btree ("invite_link_token");