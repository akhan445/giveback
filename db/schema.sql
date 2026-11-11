-- giveback schema. Idempotent: safe to run repeatedly (npm run db:migrate).
-- Money is always integer cents.

CREATE TABLE IF NOT EXISTS payments (
  id                 BIGSERIAL PRIMARY KEY,
  paypal_capture_id  TEXT NOT NULL UNIQUE,      -- the idempotency key for a payment
  paypal_order_id    TEXT,
  amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
  fee_cents          INTEGER NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  currency           TEXT NOT NULL DEFAULT 'USD',
  status             TEXT NOT NULL,             -- COMPLETED, PENDING, REFUNDED, ...
  kind               TEXT NOT NULL DEFAULT 'sale' CHECK (kind IN ('sale', 'donation')),
  description        TEXT,
  payer_email        TEXT,
  source             TEXT NOT NULL DEFAULT 'capture' CHECK (source IN ('capture', 'webhook', 'seed')),
  paid_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS fee_covered_cents INTEGER NOT NULL DEFAULT 0 CHECK (fee_covered_cents >= 0);
CREATE INDEX IF NOT EXISTS payments_paid_at_idx ON payments (paid_at);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id     TEXT PRIMARY KEY,                -- PayPal retries reuse this id: dedupe key
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row: who this organization is. Drives which AI opportunities it sees.
CREATE TABLE IF NOT EXISTS org_settings (
  id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name       TEXT NOT NULL DEFAULT 'Riverside Community Kitchen',
  org_type   TEXT NOT NULL DEFAULT 'food_bank',
  tradition  TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO org_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
