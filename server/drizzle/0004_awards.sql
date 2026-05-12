-- Custom awards table: commissioners grant glyph+color badges to teams
CREATE TABLE IF NOT EXISTS "huddle_awards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "huddle_id" uuid NOT NULL REFERENCES "huddles"("id") ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS "huddle_awards_huddle_idx" ON "huddle_awards" ("huddle_id");
CREATE INDEX IF NOT EXISTS "huddle_awards_huddle_roster_idx" ON "huddle_awards" ("huddle_id", "roster_id");
