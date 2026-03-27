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

**Success page:** `thanks.md` in the repo root.