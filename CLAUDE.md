## Contact email

The shop contact email is **john@uberniche.co.uk**. NEVER use john.rae@gmail.com anywhere in this codebase — not in mailto links, not in comments, not in scripts.

---

## Stripe Checkout

Payments use Stripe Checkout sessions rather than Stripe Payment Links.

**Flow:**
1. User clicks a buy button on a product page
2. The button calls a Cloudflare Worker via `fetch()` POST
3. The Worker creates a Stripe Checkout session using the Stripe REST API
4. The browser redirects to the returned `session.url` (Stripe-hosted checkout page)
5. On success, Stripe redirects to `https://uberniche.co.uk/thanks`

**Cloudflare Worker:** `https://autumn-bread-f290.uber-niche-parts.workers.dev/`  
The Worker expects a JSON body: `{ "priceId": "price_xxx" }`  
The Stripe secret key is stored as an encrypted environment variable (`STRIPE_SECRET_KEY`) in the Cloudflare Worker settings — it is NOT in the codebase.

**Buy button pattern** (used in each product `.md` file):
- Calls the worker with the product's Stripe price ID
- Redirects to Stripe checkout on success
- Shows a loading state and error alert on failure

**Stripe price IDs** are found in the Stripe dashboard under Products. Each product page uses its own `priceId`.
Run `STRIPE_SECRET_KEY=sk_live_xxx node scripts/stripe-prices.js` to list all active prices and IDs.

**Success page:** `thanks.md` in the repo root.

---

## Stripe → Click & Drop automation

**File:** `cloudflare/webhook-worker.js` — a second Cloudflare Worker (deployed separately).

**Flow:**
1. Customer completes Stripe checkout
2. Stripe fires `checkout.session.completed` webhook to this worker
3. Worker verifies Stripe signature, fetches full session (line items + shipping address)
4. Worker POSTs order to Royal Mail Click & Drop API
5. Order appears in Click & Drop ready to label and ship

**Required environment variables** (set in Cloudflare Workers dashboard, never in code):
- `STRIPE_SECRET_KEY` — same key as the checkout worker
- `STRIPE_WEBHOOK_SECRET` — from Stripe Dashboard → Webhooks → your endpoint → Signing secret
- `CLICK_AND_DROP_API_KEY` — from Click & Drop → Settings → Integrations → Click & Drop API

**Deployment:** Both Cloudflare Workers (`cloudflare/worker.js` and `cloudflare/webhook-worker.js`) are automatically deployed via GitHub Actions (`.github/workflows/deploy-workers.yml`) on every push to `main` that touches files under `cloudflare/` or `assets/basket.js`. No manual deployment is needed.

**Initial setup steps** (one-time, already done):
1. Deploy `cloudflare/webhook-worker.js` as a new Cloudflare Worker and note its URL
2. In Stripe Dashboard: Webhooks → Add endpoint → set URL to the worker → listen for `checkout.session.completed` → copy the Signing secret
3. Add all three env vars to the Cloudflare Worker settings

**Note on weights:** The webhook worker uses a default of 500g per item. Update `unitWeightInGrams` in `buildClickAndDropOrder()` per product if Click & Drop needs accurate weights for postage selection.

---

## Click & Drop tracking-number notifier

**File:** `cloudflare/tracking-notifier.js` — a third Cloudflare Worker, deployed separately, triggered every 15 minutes by a Cron Trigger (not HTTP).

Royal Mail's Click & Drop API has **no webhooks**. A tracking number only appears on an order once its label is actually printed — a manual step done later in the Click & Drop dashboard, separate from order creation — so the only way to find out is to poll `GET /orders`.

**Flow:**
1. Every 15 minutes, the worker polls Click & Drop's `GET /orders` (last 14 days, paginated via `continuationToken`) for orders that now have a `trackingNumber`
2. For each tracking number it hasn't seen before, it looks up the customer's email (stashed in KV by `webhook-worker.js` at order-creation time, since Click & Drop never returns it back to us) and emails **auto@uberniche.co.uk** with the customer email + tracking code + order reference
3. **Not sent to customers yet** — this is an internal notification only, first cut

**State:** Since Workers are stateless and orders aren't guaranteed to be processed in order, both workers share a KV namespace bound as `ORDER_TRACKING`:
- `webhook-worker.js` writes `order-email:{orderIdentifier}` → customer email (60-day TTL) after creating each Click & Drop order
- `tracking-notifier.js` writes `notified:{orderIdentifier}:{trackingNumber}` (90-day TTL) as a dedup marker once it has successfully sent the email, so the same tracking number isn't emailed twice on the next poll

**Required environment variables** (set in Cloudflare Workers dashboard, never in code):
- `CLICK_AND_DROP_API_KEY` — same key as the webhook worker
- `RESEND_API_KEY` — Resend API key (same Resend account used by ApexHunterWeb; sends from `noreply@mail.uberniche.co.uk`)
- `TEST_TRIGGER_SECRET` — optional; if set, allows manually triggering a poll via `curl` with `Authorization: Bearer <secret>` for testing. Without it the HTTP fetch handler always returns 401 (the real trigger is the cron)

**Initial setup steps** (one-time):
1. ✅ Done — KV namespace created, id `57adf558900e40b9ada8cca9494ef920` set in both `cloudflare/wrangler-webhook.toml` and `cloudflare/wrangler-tracking-notifier.toml`
2. ✅ Done — `RESEND_API_KEY`, `CLICK_AND_DROP_API_KEY`, and `TEST_TRIGGER_SECRET` are set on the `tracking-notifier` Worker in the Cloudflare dashboard
3. Confirm `mail.uberniche.co.uk` is verified in Resend (it already is, for ApexHunterWeb)

**Known-fixed bug (2026-09-01):** Click & Drop puts `trackingNumber` on the order object
itself, never on entries in `packages` (those only ever carry a `packageNumber`). The
notifier originally checked `packages[].trackingNumber` first and never fell back, so
every poll found 0 tracking numbers despite labels being printed — see
`extractTrackingNumbers()` in `tracking-notifier.js` and its tests in
`scripts/test-tracking-notifier.js`.

---

## Scripts

**Run tests:** `npm test` — runs the pure/offline unit test scripts (`test-order-builder.js`,
`test-tracking-notifier.js`). This is also a required check in `deploy-workers.yml`; a
push to `main` under `cloudflare/**` won't deploy if it fails.

Other scripts hit live services and need locally-stored secrets, so they stay manual-only
— run with `npm run <name>` (see `package.json`):
- `test:webhook-auth` — posts to the live webhook worker (no real Stripe payments)
- `test:checkout-worker` — creates real (uncompleted) Stripe checkout sessions
- `test:clickanddrop` — creates a real test order in Click & Drop
- `probe:clickanddrop` — lists recent live orders with full details

**`scripts/stripe-prices.js`** — lists all active Stripe prices with product names and IDs.
Usage: `STRIPE_SECRET_KEY=sk_live_xxx node scripts/stripe-prices.js`
No npm install needed — uses Node.js built-in `fetch`.