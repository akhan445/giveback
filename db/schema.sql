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
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payer_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payer_country TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payer_city TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS anonymous BOOLEAN NOT NULL DEFAULT false;
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

-- Fundraising goal shown on the live display (thermometer, goal card). goal_start null = first of this month.
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS goal_name  TEXT NOT NULL DEFAULT 'Holiday meals campaign';
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS goal_cents INTEGER NOT NULL DEFAULT 800000 CHECK (goal_cents > 0);
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS goal_start DATE;

-- Impact widget settings. All nullable: null means "use the default for this organization type" (lib/impact.ts).
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS impact_hero       TEXT;
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS impact_cell       TEXT;
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS impact_unit       TEXT;
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS impact_done       TEXT;
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS impact_unit_cents INTEGER CHECK (impact_unit_cents IS NULL OR impact_unit_cents > 0);

-- Cashback payouts: giveback (the platform sandbox account) pays accrued cashback to the organization
-- through the PayPal Payouts API. A row is written BEFORE calling PayPal (status PENDING) so a double click
-- or a retry can never pay twice; `id` becomes the PayPal sender_batch_id.
CREATE TABLE IF NOT EXISTS cashback_payouts (
  id              BIGSERIAL PRIMARY KEY,
  year            INTEGER NOT NULL,                 -- the year of cashback this payout settles
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  currency        TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  trigger         TEXT NOT NULL CHECK (trigger IN ('manual', 'year_end')),
  status          TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, PROCESSING, SUCCESS, FAILED, UNCLAIMED, RETURNED, ...
  paypal_batch_id TEXT UNIQUE,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Where cashback is sent. null = PAYOUT_RECIPIENT_EMAIL from the environment.
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS payout_email TEXT;

-- giveback's own fee on each payment (the platform fee, on top of PayPal's). Computed on the server (lib/fees.ts).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0);

-- Settlement: after a payment lands in the giveback platform account, the vendor is paid its share through the
-- Payouts API (payment - PayPal fee - giveback fee). One row per payment (unique), written BEFORE the PayPal call
-- so webhook + capture racing each other can never pay the vendor twice. `id` becomes the PayPal sender_batch_id.
CREATE TABLE IF NOT EXISTS settlements (
  id              BIGSERIAL PRIMARY KEY,
  payment_id      BIGINT NOT NULL UNIQUE REFERENCES payments(id),
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  currency        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  paypal_batch_id TEXT UNIQUE,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PayPal's fee for paying the vendor (Payouts), bundled into the admin fee. Set when a payment is settled.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payout_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (payout_fee_cents >= 0);

-- Sponsors the AI can propose invoicing, and the PayPal invoices sent to them (Invoicing API).
CREATE TABLE IF NOT EXISTS sponsors (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  email        TEXT NOT NULL,
  pledge_cents INTEGER NOT NULL CHECK (pledge_cents > 0),
  currency     TEXT NOT NULL,
  due_date     DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sponsor_invoices (
  id                BIGSERIAL PRIMARY KEY,
  sponsor_id        BIGINT NOT NULL REFERENCES sponsors(id),
  amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
  currency          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | SENT | PAID | CANCELLED | FAILED
  paypal_invoice_id TEXT UNIQUE,
  invoice_number    TEXT,
  link              TEXT,
  error             TEXT,
  sent_at           TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One live invoice per sponsor: a double click or retry can never send two.
CREATE UNIQUE INDEX IF NOT EXISTS sponsor_invoices_one_live ON sponsor_invoices (sponsor_id) WHERE status IN ('PENDING', 'SENT', 'PAID');

-- The items a volunteer can sell on the Counter (editable there). Prices are USD cents; the server prices every order from here.
CREATE TABLE IF NOT EXISTS catalog_items (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  sort        INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS counter_title TEXT NOT NULL DEFAULT 'Riverside Community Bake Sale';

-- Ask giveback: the saved conversation (one organization) and the AI summaries shown on the dashboard.
CREATE TABLE IF NOT EXISTS chat_messages (
  id         BIGSERIAL PRIMARY KEY,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  text       TEXT NOT NULL,
  proposals  JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_summaries (
  id         BIGSERIAL PRIMARY KEY,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Working drafts: when a director settles an opportunity in Ask giveback, a short AI summary is saved against that card.
CREATE TABLE IF NOT EXISTS working_drafts (
  card_id    TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  summary    TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
