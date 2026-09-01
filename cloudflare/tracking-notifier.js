/**
 * Click & Drop tracking-number notifier
 *
 * Royal Mail's Click & Drop API has no webhooks — a tracking number only
 * appears on an order once its label has actually been printed (a manual
 * step done later in the Click & Drop dashboard), so the only way to find
 * out is to poll GET /orders. This worker runs on a Cron Trigger, polls for
 * recently-tracked orders, and emails auto@uberniche.co.uk with the
 * customer's name, email, order contents, and tracking link for each one
 * it hasn't seen before.
 *
 * NOT sent to customers yet — internal notification only, first cut.
 *
 * Required Cloudflare environment variables (set in Workers dashboard, not in code):
 *   CLICK_AND_DROP_API_KEY - same key used in the webhook worker
 *   RESEND_API_KEY         - Resend API key (same account used by ApexHunterWeb)
 *   STRIPE_SECRET_KEY      - read-only lookup of the customer's name, email and
 *     line items. Click & Drop never gives any of that back to us, but its
 *     orderReference is "stripe-" + the last 8 chars of the Stripe checkout
 *     session id, so we search Stripe sessions created around the order's
 *     timestamp and match by that suffix.
 *
 * Required KV binding:
 *   ORDER_TRACKING - notified:{orderIdentifier}:{trackingNumber} as a dedup
 *     marker so the same tracking number isn't emailed twice.
 *
 * Deploy as a separate Worker with a Cron Trigger (see wrangler-tracking-notifier.toml).
 */

const CLICK_AND_DROP_BASE = "https://api.parcel.royalmail.com/api/v1";
const STRIPE_BASE = "https://api.stripe.com/v1";
const NOTIFY_TO = "auto@uberniche.co.uk";
const LOOKBACK_DAYS = 14; // how far back to check for orders that may have just been labeled

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pollAndNotify(env));
  },

  // Manual trigger for testing: curl the worker URL with
  // `Authorization: Bearer <TEST_TRIGGER_SECRET>`.
  async fetch(req, env) {
    const auth = req.headers.get("Authorization");
    if (!env.TEST_TRIGGER_SECRET || auth !== `Bearer ${env.TEST_TRIGGER_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    await pollAndNotify(env);
    return new Response("OK", { status: 200 });
  },
};

async function pollAndNotify(env) {
  const startDateTime = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let continuationToken;
  let ordersSeen = 0, trackingNumbersSeen = 0, sent = 0;

  do {
    const page = await fetchOrdersPage(env.CLICK_AND_DROP_API_KEY, startDateTime, continuationToken);
    continuationToken = page.continuationToken;

    for (const order of page.orders ?? []) {
      ordersSeen++;
      for (const trackingNumber of extractTrackingNumbers(order)) {
        trackingNumbersSeen++;
        if (await notifyIfNew(env, order, trackingNumber)) sent++;
      }
    }
  } while (continuationToken);

  console.log(`Poll complete: ${ordersSeen} orders seen, ${trackingNumbersSeen} tracking numbers found, ${sent} new emails sent`);
}

// Click & Drop puts trackingNumber on the order itself, not on entries in
// `packages` (those only ever carry a packageNumber) — but fall back to a
// per-package trackingNumber in case a future multi-package order has one.
function extractTrackingNumbers(order) {
  const packages = order.packages?.length ? order.packages : [{}];
  return packages
    .map((pkg) => pkg.trackingNumber ?? order.trackingNumber)
    .filter(Boolean);
}

async function notifyIfNew(env, order, trackingNumber) {
  const dedupKey = `notified:${order.orderIdentifier}:${trackingNumber}`;
  const alreadyNotified = await env.ORDER_TRACKING.get(dedupKey);
  if (alreadyNotified) return false;

  const orderInfo = await getOrderInfo(env.STRIPE_SECRET_KEY, order);

  try {
    await sendNotificationEmail(env.RESEND_API_KEY, { ...orderInfo, trackingNumber });
    // Only mark as notified once the email actually sent, so a Resend failure
    // gets retried on the next poll instead of being silently dropped.
    await env.ORDER_TRACKING.put(dedupKey, "1", { expirationTtl: 90 * 24 * 60 * 60 });
    return true;
  } catch (err) {
    console.error(`Failed to notify for order ${order.orderIdentifier} / ${trackingNumber}:`, err.message);
    return false;
  }
}

async function getOrderInfo(stripeApiKey, order) {
  const fallback = { email: "unknown", name: null, items: [] };
  try {
    const session = await findStripeSession(stripeApiKey, order.orderReference, order.orderDate);
    return session ? extractOrderInfoFromSession(session) : fallback;
  } catch (err) {
    console.error(`Stripe lookup failed for ${order.orderReference}:`, err.message);
    return fallback;
  }
}

// orderReference is "stripe-" + last 8 chars of the Stripe checkout session
// id (see buildClickAndDropOrder in webhook-worker.js) — Click & Drop only
// ever gives us that reference back, never the full session id.
function stripeSuffixFromOrderReference(orderReference) {
  return orderReference?.startsWith("stripe-") ? orderReference.slice("stripe-".length) : null;
}

async function findStripeSession(apiKey, orderReference, orderDate) {
  const suffix = stripeSuffixFromOrderReference(orderReference);
  if (!suffix || !orderDate || !apiKey) return null;

  const sessionId = await findSessionIdBySuffix(apiKey, suffix, orderDate);
  if (!sessionId) return null;

  return stripeGet(
    apiKey,
    `/checkout/sessions/${sessionId}?expand[]=line_items&expand[]=line_items.data.price.product`
  );
}

// Click & Drop's orderDate is Stripe's session.created verbatim (see
// buildClickAndDropOrder), so a narrow window around it should return very
// few sessions to scan for a suffix match.
async function findSessionIdBySuffix(apiKey, suffix, orderDate) {
  const created = Math.floor(new Date(orderDate).getTime() / 1000);
  const windowSeconds = 10 * 60;
  let startingAfter;

  do {
    const params = new URLSearchParams({
      limit: "100",
      "created[gte]": String(created - windowSeconds),
      "created[lte]": String(created + windowSeconds),
    });
    if (startingAfter) params.set("starting_after", startingAfter);

    const page = await stripeGet(apiKey, `/checkout/sessions?${params}`);
    const match = page.data.find((s) => s.id.endsWith(suffix));
    if (match) return match.id;

    startingAfter = page.has_more ? page.data[page.data.length - 1]?.id : null;
  } while (startingAfter);

  return null;
}

async function stripeGet(apiKey, path) {
  const res = await fetch(`${STRIPE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = await res.json();
  if (json.error) throw new Error(`Stripe error: ${json.error.message}`);
  return json;
}

// Mirrors buildClickAndDropOrder's contents/name/email extraction in
// webhook-worker.js so the notifier email shows the same info the order was
// created with.
function extractOrderInfoFromSession(session) {
  const shippingName =
    session.collected_information?.shipping_details?.name ?? session.shipping_details?.name ?? null;
  const name = shippingName || session.customer_details?.name || null;
  const email = session.customer_details?.email ?? "unknown";

  let itemLabels = {};
  try { itemLabels = JSON.parse(session.metadata?.item_labels ?? "{}"); } catch {}

  const items = (session.line_items?.data ?? []).map((item) => {
    const label = itemLabels[item.price?.id];
    const baseName = item.description || item.price?.product?.name || "Item";
    return {
      name: label ? `${baseName} (${label})` : baseName,
      quantity: item.quantity,
      unitValue: Math.round((item.amount_subtotal ?? item.amount_total) / item.quantity) / 100,
    };
  });

  return { email, name, items };
}

async function fetchOrdersPage(apiKey, startDateTime, continuationToken) {
  const params = new URLSearchParams({ pageSize: "100", startDateTime });
  if (continuationToken) params.set("continuationToken", continuationToken);

  const res = await fetch(`${CLICK_AND_DROP_BASE}/orders?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Click & Drop ${res.status}: ${text}`);
  return JSON.parse(text);
}

function buildTrackingUrl(trackingNumber) {
  return `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(trackingNumber)}`;
}

function buildNotificationEmailHtml({ email, name, items, trackingNumber }) {
  const trackingUrl = buildTrackingUrl(trackingNumber);

  const itemsHtml = items?.length
    ? `<ul>${items
        .map((i) => {
          const qty = i.quantity > 1 ? `${i.quantity}x ` : "";
          const price = typeof i.unitValue === "number" ? ` — £${i.unitValue.toFixed(2)}` : "";
          return `<li>${qty}${escapeHtml(i.name)}${price}</li>`;
        })
        .join("")}</ul>`
    : "";

  return `
    <div style="font-family:sans-serif">
      <p>Royal Mail has issued a tracking number for ${name ? `<strong>${escapeHtml(name)}</strong>'s` : "an"} order.</p>
      <p><strong>Customer email:</strong> ${escapeHtml(email)}</p>
      ${itemsHtml}
      <p>Click this twice — the first time probably won't work:</p>
      <p><a href="${trackingUrl}">${trackingUrl}</a></p>
    </div>
  `;
}

async function sendNotificationEmail(apiKey, { email, name, items, trackingNumber }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Click & Drop Notifier <noreply@mail.uberniche.co.uk>",
      to: NOTIFY_TO,
      subject: `Label printed: ${trackingNumber}`,
      html: buildNotificationEmailHtml({ email, name, items, trackingNumber }),
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend error: ${await res.text()}`);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
