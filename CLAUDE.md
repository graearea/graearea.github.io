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

**Deployment steps:**
1. Deploy `cloudflare/webhook-worker.js` as a new Cloudflare Worker and note its URL
2. In Stripe Dashboard: Webhooks → Add endpoint → set URL to the worker → listen for `checkout.session.completed` → copy the Signing secret
3. Add all three env vars to the Cloudflare Worker settings

**Note on weights:** The webhook worker uses a default of 500g per item. Update `unitWeightInGrams` in `buildClickAndDropOrder()` per product if Click & Drop needs accurate weights for postage selection.

---

## Scripts

**`scripts/stripe-prices.js`** — lists all active Stripe prices with product names and IDs.
Usage: `STRIPE_SECRET_KEY=sk_live_xxx node scripts/stripe-prices.js`
No npm install needed — uses Node.js built-in `fetch`.