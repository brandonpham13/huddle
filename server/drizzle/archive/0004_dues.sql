-- Dues Tracker: commissioner-set due amount per huddle, and per-roster payment records.

CREATE TABLE IF NOT EXISTS "huddle_dues_config" (
  "huddle_id" uuid PRIMARY KEY REFERENCES "huddles"("id") ON DELETE CASCADE,
  "amount" integer NOT NULL,
  "season" text,
  "note" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "huddle_dues_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "huddle_id" uuid NOT NULL REFERENCES "huddles"("id") ON DELETE CASCADE,
  "roster_id" integer NOT NULL,
  "paid_at" timestamptz,
  "marked_by" text NOT NULL,
  "note" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "huddle_dues_payments_huddle_roster_uniq"
  ON "huddle_dues_payments" ("huddle_id", "roster_id");
