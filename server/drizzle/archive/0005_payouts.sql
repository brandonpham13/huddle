-- Payout structure entries for a huddle.
-- Each row is one line item (e.g. "1st Place $200", "Sacko -$20").
-- Commissioner replaces all entries in one PUT (delete + re-insert).
CREATE TABLE IF NOT EXISTS huddle_payout_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id   UUID NOT NULL REFERENCES huddles(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  amount      INTEGER NOT NULL DEFAULT 0,  -- cents
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS huddle_payout_entries_huddle_idx
  ON huddle_payout_entries(huddle_id);
