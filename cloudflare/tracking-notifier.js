/**
 * Click & Drop tracking-number notifier
 *
 * Royal Mail's Click & Drop API has no webhooks — a tracking number only
 * appears on an order once its label has actually been printed (a manual
 * step done later in the Click & Drop dashboard), so the only way to find
 * out is to poll GET /orders. This worker runs on a Cron Trigger, polls for
 * recently-tracked orders, and emails auto@uberniche.co.uk with the
 * customer's email + tracking code for each one it hasn't seen before.
 *
 * NOT sent to customers yet — internal notification only, first cut.
 *
 * Required Cloudflare environment variables (set in Workers dashboard, not in code):
 *   CLICK_AND_DROP_API_KEY - same key used in the webhook worker
 *   RESEND_API_KEY         - Resend API key (same account used by ApexHunterWeb)
 *
 * Required KV binding:
 *   ORDER_TRACKING - shared with webhook-worker.js. Read: order-email:{orderIdentifier}
 *     (written at order-creation time). Write: notified:{orderIdentifier}:{trackingNumber}
 *     as a dedup marker so the same tracking number isn't emailed twice.
 *
 * Deploy as a separate Worker with a Cron Trigger (see wrangler-tracking-notifier.toml).
 */

const CLICK_AND_DROP_BASE = "https://api.parcel.royalmail.com/api/v1";
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

  do {
    const page = await fetchOrdersPage(env.CLICK_AND_DROP_API_KEY, startDateTime, continuationToken);
    continuationToken = page.continuationToken;

    for (const order of page.orders ?? []) {
      const packages = order.packages?.length ? order.packages : [{ trackingNumber: order.trackingNumber }];
      for (const pkg of packages) {
        if (!pkg.trackingNumber) continue;
        await notifyIfNew(env, order, pkg.trackingNumber);
      }
    }
  } while (continuationToken);
}

async function notifyIfNew(env, order, trackingNumber) {
  const dedupKey = `notified:${order.orderIdentifier}:${trackingNumber}`;
  const alreadyNotified = await env.ORDER_TRACKING.get(dedupKey);
  if (alreadyNotified) return;

  const email = (await env.ORDER_TRACKING.get(`order-email:${order.orderIdentifier}`)) ?? "unknown";

  try {
    await sendNotificationEmail(env.RESEND_API_KEY, {
      email,
      trackingNumber,
      orderReference: order.orderReference,
    });
    // Only mark as notified once the email actually sent, so a Resend failure
    // gets retried on the next poll instead of being silently dropped.
    await env.ORDER_TRACKING.put(dedupKey, "1", { expirationTtl: 90 * 24 * 60 * 60 });
  } catch (err) {
    console.error(`Failed to notify for order ${order.orderIdentifier} / ${trackingNumber}:`, err.message);
  }
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

async function sendNotificationEmail(apiKey, { email, trackingNumber, orderReference }) {
  const trackingUrl = `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(trackingNumber)}`;

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
      html: `
        <div style="font-family:sans-serif">
          <p>Royal Mail has issued a tracking number for an order.</p>
          <ul>
            <li><strong>Customer email:</strong> ${escapeHtml(email)}</li>
            <li><strong>Tracking number:</strong> ${escapeHtml(trackingNumber)}</li>
            <li><strong>Order reference:</strong> ${escapeHtml(orderReference ?? "unknown")}</li>
          </ul>
          <p><a href="${trackingUrl}">${trackingUrl}</a></p>
        </div>
      `,
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
