/**
 * Stripe → Click & Drop webhook worker
 *
 * Receives Stripe `checkout.session.completed` webhooks, then:
 *   1. Verifies the Stripe webhook signature
 *   2. Fetches the full session (line items + shipping address) from Stripe
 *   3. Creates a shipment order in Royal Mail Click & Drop
 *
 * Required Cloudflare environment variables (set in Workers dashboard, not in code):
 *   STRIPE_SECRET_KEY       - same key used in the checkout worker
 *   STRIPE_WEBHOOK_SECRET   - from Stripe Dashboard → Webhooks → your endpoint → Signing secret
 *   CLICK_AND_DROP_API_KEY  - from Click & Drop → Settings → Integrations → Click & Drop API
 *
 * Deploy this as a separate Worker. Then in Stripe Dashboard:
 *   Webhooks → Add endpoint → set URL to this worker's URL
 *   → listen for: checkout.session.completed
 *   → copy the Signing secret into STRIPE_WEBHOOK_SECRET
 */

const STRIPE_BASE = "https://api.stripe.com/v1";
const CLICK_AND_DROP_BASE = "https://api.parcel.royalmail.com/api/v1";

export default {
  async fetch(req, env) {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    // 1. Verify the webhook came from Stripe
    const valid = await verifyStripeSignature(body, sig, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) {
      console.error("Invalid Stripe signature");
      return new Response("Unauthorized", { status: 401 });
    }

    const event = JSON.parse(body);

    // Only handle successful checkouts
    if (event.type !== "checkout.session.completed") {
      return new Response("Ignored", { status: 200 });
    }

    const session = event.data.object;

    // 2. Fetch full session details from Stripe (line items + shipping)
    const fullSession = await stripeGet(
      `/checkout/sessions/${session.id}?expand[]=line_items&expand[]=line_items.data.price.product`,
      env.STRIPE_SECRET_KEY
    );

    const shipping = fullSession.shipping_details;
    if (!shipping || !shipping.address) {
      console.error("No shipping address on session", session.id);
      return new Response("No shipping address", { status: 422 });
    }

    // 3. Build Click & Drop order
    const order = buildClickAndDropOrder(fullSession);

    const result = await createClickAndDropOrder(order, env.CLICK_AND_DROP_API_KEY);

    console.log("Click & Drop order created:", JSON.stringify(result));
    return new Response("OK", { status: 200 });
  },
};

// ---------------------------------------------------------------------------
// Stripe helpers
// ---------------------------------------------------------------------------

async function stripeGet(path, secretKey) {
  const res = await fetch(`${STRIPE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const json = await res.json();
  if (json.error) throw new Error(`Stripe error: ${json.error.message}`);
  return json;
}

/**
 * Verifies Stripe's HMAC-SHA256 webhook signature using the Web Crypto API
 * (available natively in Cloudflare Workers — no dependencies needed).
 */
async function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) return false;

  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k, v.join("=")];
    })
  );

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  // Reject webhooks older than 5 minutes to prevent replay attacks
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === signature;
}

// ---------------------------------------------------------------------------
// Order builder
// ---------------------------------------------------------------------------

function buildClickAndDropOrder(session) {
  const addr = session.shipping_details.address;
  const name = session.shipping_details.name || session.customer_details?.name || "Unknown";
  const email = session.customer_details?.email;

  // Stripe amounts are in pence
  const total = session.amount_total / 100;

  // Build a readable order reference from Stripe session ID (last 8 chars)
  const orderRef = `stripe-${session.id.slice(-8)}`;

  // Summarise line items for the order label
  const items = (session.line_items?.data || []).map((item) => ({
    name: item.description || item.price?.product?.name || "Item",
    quantity: item.quantity,
    unitValue: item.amount_total / 100 / item.quantity,
    unitWeightInGrams: 500, // default — adjust per product if needed
  }));

  return {
    orderReference: orderRef,
    orderDate: new Date(session.created * 1000).toISOString(),
    subtotal: total,
    shippingCostCharged: 0,
    total: total,
    ...(email && { emailAddress: email }),
    recipient: {
      name,
      addressLine1: addr.line1,
      ...(addr.line2 && { addressLine2: addr.line2 }),
      city: addr.city,
      ...(addr.state && { county: addr.state }),
      postcode: addr.postal_code,
      countryCode: addr.country,
    },
    packages: [
      {
        weightInGrams: items.reduce((sum, i) => sum + i.unitWeightInGrams * i.quantity, 0) || 500,
        packageFormatIdentifier: "parcel", // change to "parcel" if needed
        contents: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitValue: i.unitValue,
          unitWeightInGrams: i.unitWeightInGrams,
        })),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Click & Drop API
// ---------------------------------------------------------------------------

async function createClickAndDropOrder(order, apiKey) {
  const res = await fetch(`${CLICK_AND_DROP_BASE}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([order]), // Click & Drop accepts an array of orders
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Click & Drop error ${res.status}: ${text}`);
  }

  return JSON.parse(text);
}
