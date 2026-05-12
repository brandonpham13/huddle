CREATE TABLE IF NOT EXISTS "huddle_payout_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "huddle_id" uuid NOT NULL REFERENCES "huddles"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "amount" integer NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "huddle_payout_entries_huddle_idx" ON "huddle_payout_entries" ("huddle_id");
