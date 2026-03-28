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

    // Stripe 2025-03-31.basil moves shipping into collected_information.shipping_details.
    // Fall back through older top-level field, then billing address as last resort.
    const shipping =
      fullSession.collected_information?.shipping_details?.address
        ? fullSession.collected_information.shipping_details
        : fullSession.shipping_details?.address
          ? fullSession.shipping_details
          : fullSession.customer_details?.address
            ? { name: fullSession.customer_details.name, address: fullSession.customer_details.address }
            : null;

    if (!shipping) {
      // Can't create a shipment without an address — log and ack so Stripe doesn't retry
      console.error("No address on session", session.id, JSON.stringify(fullSession));
      return new Response("No address — skipped", { status: 200 });
    }

    // 3. Build Click & Drop order
    const order = buildClickAndDropOrder(fullSession, shipping);

    try {
      const result = await createClickAndDropOrder(order, env.CLICK_AND_DROP_API_KEY);
      console.log("Click & Drop order created:", JSON.stringify(result));
    } catch (err) {
      // Log the failure but still return 200 — Stripe must not retry fulfilled payments
      console.error("Click & Drop failed:", err.message);
    }

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

function buildClickAndDropOrder(session, shipping) {
  const addr = shipping.address;
  const name = shipping.name || session.customer_details?.name || "Unknown";
  const email = session.customer_details?.email;

  // Stripe amounts are in pence
  const subtotal = (session.amount_subtotal ?? session.amount_total) / 100;
  const shippingCost = (session.shipping_cost?.amount_total ?? 0) / 100;
  const total = session.amount_total / 100;

  // orderReference max 40 chars — keep it short
  const orderRef = `stripe-${session.id.slice(-8)}`;

  // Put custom field values (size selection, notes) into specialInstructions (max 500 chars)
  const customFields = session.custom_fields ?? [];
  const specialInstructions = customFields
    .map((f) => {
      const label = f.label?.custom ?? f.key;
      const value = f.type === "dropdown" ? f.dropdown?.value : f.text?.value;
      return value ? `${label}: ${value}` : null;
    })
    .filter(Boolean)
    .join(" | ") || undefined;

  // Click & Drop wants ISO 8601 without milliseconds
  const orderDate = new Date(session.created * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

  // Line items for parcel contents — only included if expanded by Stripe
  const lineItems = session.line_items?.data ?? [];
  const contents = lineItems.map((item) => ({
    name: item.description || item.price?.product?.name || "Item",
    quantity: item.quantity,
    unitValue: Math.round((item.amount_subtotal ?? item.amount_total) / item.quantity) / 100,
    unitWeightInGrams: 500,
  }));

  const pkg = {
    weightInGrams: contents.length
      ? contents.reduce((sum, i) => sum + i.unitWeightInGrams * i.quantity, 0)
      : 500,
    packageFormatIdentifier: "parcel",
  };
  // Only include contents if we have something — empty array upsets Click & Drop
  if (contents.length) pkg.contents = contents;

  return {
    orderReference: orderRef,
    orderDate,
    subtotal,
    shippingCostCharged: shippingCost,
    total,
    ...(specialInstructions && { specialInstructions }),
    recipient: {
      name,
      addressLine1: addr.line1,
      ...(addr.line2 && { addressLine2: addr.line2 }),
      city: addr.city,
      ...(addr.state && { county: addr.state }),
      postcode: addr.postal_code,
      countryCode: addr.country,
      // emailAddress belongs in recipient, not top-level
      ...(email && { emailAddress: email }),
    },
    packages: [pkg],
  };
}

// ---------------------------------------------------------------------------
// Click & Drop API
// ---------------------------------------------------------------------------

async function createClickAndDropOrder(order, apiKey) {
  const payload = JSON.stringify({ items: [order] });
  console.log("Sending to Click & Drop:", payload);

  const res = await fetch(`${CLICK_AND_DROP_BASE}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: payload,
  });

  const text = await res.text();
  console.log(`Click & Drop response ${res.status}:`, text);

  if (!res.ok) {
    throw new Error(`Click & Drop ${res.status}: ${text}`);
  }

  return JSON.parse(text);
}
