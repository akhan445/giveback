# giveback

**The platform that gives back.** A PayPal-powered point of sale and giving platform for nonprofits: take payments and donations, see your cash flow, ask an AI what you can afford, invoice a sponsor in one confirmed click, and earn **cashback** on every dollar you raise.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com). Everything runs on the **PayPal sandbox**: no real money moves.

- **Live demo:** https://giveback-theta.vercel.app
- **Example vendor app:** https://giveback-theta.vercel.app/vendor/dashboard (Riverside Community Kitchen)
- **Platform economics:** https://giveback-theta.vercel.app/platform
- **License:** [MIT](LICENSE)

## The idea

Nonprofits lose money on every payment and cannot see whether they will make rent next month. giveback is "Stripe for nonprofits": a platform where every payment carries **one admin fee** (PayPal's fees plus ours), and **volume earns cashback** on our part, paid back monthly through PayPal. An AI assistant forecasts cash flow from the organization's own history and can take a PayPal action, **only after the director confirms**.

### The demo loop (all of it works end to end)

1. **Sell.** A volunteer rings up a sale on the Counter, or a supporter scans the live display's QR code and pays with PayPal. Supporters can **cover the admin fee** so the nonprofit keeps 100%.
2. **Record.** PayPal's webhook confirms the payment; the dashboard updates (today's total, cashback earned, tier progress, effective fee rate). The giveback platform account is paid, keeps its fee, and **settles the nonprofit instantly through the Payouts API**.
3. **Ask.** The director asks "Can we cover the July venue rent?". The AI answers from real numbers and charts it in AG Studio.
4. **Act.** The AI suggests invoicing a sponsor and prepares the invoice. One **Confirm** click sends a **PayPal invoice**; its status updates live from PayPal.
5. **Get paid back.** Cashback is paid to the nonprofit's PayPal account with the **Payouts API**, with a PDF invoice for every payout and a year-end PDF report.

### How the money splits (a $50 payment)

| | |
|---|---|
| Supporter pays | $50.00 |
| PayPal fees (2.89% + $0.30, plus PayPal's payout fee) | − $2.69 |
| giveback (1.25% + $0.10) | − $0.73 |
| Nonprofit receives | $46.58 |
| Cashback later (0.5% / 0.75% / 1.0% of monthly volume) | + $0.25 to $0.50 |

The fees are shown to the nonprofit as one **admin fee**. All figures on the landing page come from the same code the Counter uses ([`lib/fees.ts`](lib/fees.ts)).

## What is real and what is simulated

Honesty matters here, so plainly:

- **Real (PayPal sandbox):** checkout (Orders API + JS SDK v6), webhooks with signature verification, Payouts (settlements and cashback), Invoicing (sponsor invoices), Transaction Search and Balances. All amounts move between real sandbox accounts.
- **Simulated:** the **pricing advantage** that funds cashback. In a real launch it would come from pooled-volume pricing negotiated with PayPal and a sponsor pool. The cashback tiers are a configurable rule ([`lib/cashback.ts`](lib/cashback.ts)).
- **Sandbox workaround:** PayPal cannot pay itself, so supporters pay the giveback platform account and giveback pays the nonprofit its share through Payouts. PayPal charges about 2% to send a payout; giveback bundles that into the admin fee. The payout fee cap in [`lib/fees.ts`](lib/fees.ts) is an assumption to verify before going live. Production would use PayPal's partner fee collection (or batch payouts daily).
- **Sample data:** Riverside Community Kitchen's earlier history and the sample sponsors are seeded; recent payments are real sandbox transactions.

## PayPal APIs used

| API | Where | Why |
|---|---|---|
| **Orders v2** + **JS SDK v6** | `app/api/orders`, `lib/paypal.ts`, Counter | Checkout on the device, and phone/QR checkout |
| **Webhooks** (verified) | `app/api/webhooks/paypal` | Idempotent recording of payments, payout and invoice status |
| **Payouts** | `lib/paypal-payouts.ts`, `lib/settlements.ts`, `lib/payouts.ts` | Instant settlement to the nonprofit; monthly and year-end cashback |
| **Invoicing** | `lib/sponsors.ts` | Sponsor invoices (create, send, status) |
| **Transaction Search**, **Balances** | `app/(endpoints)` pages, AG Studio data | Reports over live sandbox data |

## AI tools and models

- **Model:** OpenAI **gpt-5.6-luna** (default; chosen for low cost and speed so judges can test freely), with `gpt-5.4-mini` and `gpt-5-mini` as alternates. Set by `OPENAI_MODELS`.
- **Ask giveback (chat):** a tool-calling assistant ([`app/api/chat`](app/api/chat/route.ts), [`lib/chat-tools.ts`](lib/chat-tools.ts)). Every figure comes from the same engine as the dashboard cards, so they never disagree. It can **propose** a sponsor invoice but never sends one: the director confirms in a card.
- **AG Studio** with its AI assistant and a swappable model adapter ([`app/(app)/vendor/reports`](app/(app)/vendor/reports)): reports, custom widgets (live display, impact grid, world map) and a custom theme.
- **Built with:** Claude Code (Claude Sonnet 5.5), the PayPal AI Toolkit and the APIMatic Context Plugin for PayPal.
- The AI never moves money without an explicit confirmation step, and invoice amounts always come from the database, never from the model.

## Try it (sandbox logins)

Sign in at [sandbox.paypal.com](https://www.sandbox.paypal.com). These sandbox accounts stay available through Dec 15, 2026.

| Role | Email | Password |
|---|---|---|
| Supporter (personal): use this to pay | `sb-0he9w53817163@personal.example.com` | `ADD_PASSWORD_HERE` |
| Nonprofit (business): receives money and invoices | `sb-kxj6f53815421@business.example.com` | `ADD_PASSWORD_HERE` |
| giveback platform (business) | `giveback@business.example.com` | `ADD_PASSWORD_HERE` |

A quick tour: open the [vendor app](https://giveback-theta.vercel.app/vendor/dashboard), add items on the **Counter** and choose **Pay on this device** or scan the QR with a phone, pay with the supporter account, then watch the **Dashboard** and **Cashback** pages update. In **Ask giveback**, try: *"Can we cover the July venue rent of $6000?"*, then confirm the invoice it prepares.

## Run locally

Requires Node.js 20.9+, a Postgres database ([Neon](https://neon.com) free tier works), and PayPal sandbox REST apps ([developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox)).

```bash
npm install
cp env.example .env.local     # fill in the values (see below)
npm run db:migrate            # creates the tables
npm run db:seed               # optional: realistic sandbox history for the sample nonprofit
npm run dev                   # http://localhost:3000
```

Other scripts: `npm test` (63 tests), `npm run typecheck`, `npm run lint`, `npm run build`.

### Configuration

Two PayPal sandbox apps are used: the **vendor's merchant account** (`PAYPAL_CLIENT_ID`/`PAYPAL_SECRET`) and the **giveback platform account** (`PAYOUT_CLIENT_ID`/`PAYOUT_CLIENT_SECRET`). With `CHECKOUT_MODE=platform` supporters pay the platform account and the nonprofit is settled by payout; any other value pays the nonprofit's account directly. See [`env.example`](env.example) for every variable, including:

- `DATABASE_URL`, `DATABASE_URL_UNPOOLED`: Postgres.
- `PAYPAL_WEBHOOK_ID`, `PAYOUT_WEBHOOK_ID`: webhook ids for the two apps. Point both webhooks at `https://<your-host>/api/webhooks/paypal`. Subscribe the vendor app to payment, payouts and invoicing events.
- `NEXT_PUBLIC_APP_URL`: the public URL (QR codes and PayPal return links use it; it must not be localhost for phone payments).
- `AG_STUDIO` (licence), `AG_STUDIO_OPENAI_API_KEY`, `OPENAI_MODELS`, `OPENAI_TPM`: the dashboard and AI assistant.
- `CRON_SECRET`: protects the year-end payout cron (`vercel.json`).
- No secrets are committed; `.env.local` is git-ignored.

### Deploying

Deployed on Vercel (Hobby) with Neon Postgres. Set the same variables in the project settings and add the webhook URL above in PayPal. The year-end cashback payout runs as a Vercel Cron on Dec 31.

## How it is built

```
app/page.tsx                 Landing page
app/(app)/vendor/            The example vendor: counter, dashboard, cashback, reports (AG Studio), settings
app/platform/                Platform economics: real numbers + an illustrative scale model
app/pay/                     What a supporter's phone sees (donate page, PAID confirmation)
app/api/                     Orders, webhooks, payouts, sponsor invoices, chat, cron
lib/fees.ts                  Admin fee: PayPal + payout fee + giveback fee (integer cents)
lib/cashback.ts, ledger.ts   Tiered cashback and the year ledger
lib/settlements.ts           Instant settlement to the nonprofit after each payment
lib/payouts.ts               Cashback payouts: balance, rules, status, PDF invoices
lib/sponsors.ts              Sponsor invoices through the Invoicing API
db/schema.sql                Postgres schema (idempotent)
```

Engineering notes: money is always integer cents and amounts are computed on the server, never trusted from the client; webhook signatures are verified and handled idempotently (PayPal retries up to 25 times); payout and settlement rows are reserved before calling PayPal so a retry can never pay twice; the order endpoint is rate limited; money paths are covered by tests.

The project started from PayPal's [AG Grid hackathon boilerplate](https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate). The original endpoint pages (`/products`, `/plans`, `/invoices`, `/transactions`, `/balances`) are still in the repo.

## License

[MIT](LICENSE)
