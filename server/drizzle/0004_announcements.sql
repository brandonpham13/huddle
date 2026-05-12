CREATE TABLE IF NOT EXISTS "huddle_announcements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "huddle_id" uuid NOT NULL REFERENCES "huddles"("id") ON DELETE CASCADE,
  "author_id" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "huddle_announcements_huddle_idx" ON "huddle_announcements" ("huddle_id");
