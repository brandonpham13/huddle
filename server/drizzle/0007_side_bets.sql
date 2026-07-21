-- Side bets: league members wager against each other on a specific week.
-- Lifecycle: pending → accepted/rejected, then accepted → settled/cancelled.

DO $$ BEGIN
  CREATE TYPE "side_bet_status" AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'settled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "side_bets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "huddle_id" uuid NOT NULL REFERENCES "huddles"("id") ON DELETE CASCADE,
  "proposer_id" text NOT NULL,
  "opponent_id" text NOT NULL,
  "proposer_roster_id" integer,
  "opponent_roster_id" integer,
  "week" integer NOT NULL,
  "season" text NOT NULL,
  "description" text NOT NULL,
  -- Amount in cents. 0 means no monetary stake (bragging rights only).
  "amount" integer NOT NULL DEFAULT 0,
  "status" "side_bet_status" NOT NULL DEFAULT 'pending',
  -- Clerk userId of the winner. Null until settled.
  "winner_id" text,
  "settlement_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "side_bets_huddle_idx" ON "side_bets" ("huddle_id");
CREATE INDEX IF NOT EXISTS "side_bets_proposer_idx" ON "side_bets" ("huddle_id", "proposer_id");
CREATE INDEX IF NOT EXISTS "side_bets_opponent_idx" ON "side_bets" ("huddle_id", "opponent_id");
