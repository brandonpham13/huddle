-- Controls which built-in auto-trophies are shown per huddle.
-- Opt-out model: if no row exists for a type, it is enabled by default.
CREATE TABLE IF NOT EXISTS huddle_active_trophies (
  huddle_id    UUID    NOT NULL REFERENCES huddles(id) ON DELETE CASCADE,
  trophy_type  TEXT    NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 1,  -- 1 = on, 0 = off
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (huddle_id, trophy_type)
);
