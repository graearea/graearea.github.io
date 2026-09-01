#!/usr/bin/env node
/**
 * Unit tests for extractTrackingNumbers, buildNotificationEmailHtml,
 * stripeSuffixFromOrderReference and extractOrderInfoFromSession
 * (cloudflare/tracking-notifier.js).
 *
 * extractTrackingNumbers fixtures are based on real responses pulled from
 * GET /orders on the live Click & Drop account: trackingNumber lives on the
 * order object, never on entries in `packages` (those only ever carry a
 * packageNumber). A prior bug assumed the opposite — checked
 * `pkg.trackingNumber` first and skipped the order-level fallback whenever
 * `packages` was non-empty, which it always is — so every poll found 0
 * tracking numbers despite labels being printed.
 *
 * Click & Drop never gives back the customer's name, email or line items, so
 * the notifier looks them up directly from Stripe: orderReference is
 * "stripe-" + the last 8 chars of the checkout session id, matched against
 * sessions created around the order's timestamp.
 *
 * No external calls — all pure function tests.
 *
 * IMPORTANT: This inlines the above functions from cloudflare/tracking-notifier.js.
 * Keep this copy in sync when the worker changes.
 */

"use strict";

// ---------------------------------------------------------------------------
// Inlined from cloudflare/tracking-notifier.js
// ---------------------------------------------------------------------------

function extractTrackingNumbers(order) {
  const packages = order.packages?.length ? order.packages : [{}];
  return packages
    .map((pkg) => pkg.trackingNumber ?? order.trackingNumber)
    .filter(Boolean);
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

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function stripeSuffixFromOrderReference(orderReference) {
  return orderReference?.startsWith("stripe-") ? orderReference.slice("stripe-".length) : null;
}

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

// ---------------------------------------------------------------------------
// Minimal test harness
// ---------------------------------------------------------------------------

let pass = 0, fail = 0;

function eq(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`);
    console.log(`      expected: ${e}`);
    console.log(`      actual:   ${a}`);
    fail++;
  }
}

function has(label, haystack, needle) {
  if (haystack.includes(needle)) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`);
    console.log(`      expected to contain: ${needle}`);
    fail++;
  }
}

function hasNot(label, haystack, needle) {
  if (!haystack.includes(needle)) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`);
    console.log(`      expected NOT to contain: ${needle}`);
    fail++;
  }
}

// ---------------------------------------------------------------------------
// Tests: real Click & Drop order shapes
// ---------------------------------------------------------------------------

console.log("\nlabeled order (real shape)");

{
  // Real shape for a labeled/shipped order: trackingNumber on the order,
  // packages entries carry only packageNumber.
  const order = {
    orderIdentifier: 1245,
    orderReference: "stripe-Xy5xUqwz",
    printedOn: "2026-08-19T17:29:53.6096057",
    shippedOn: "2026-08-19T22:34:17.09",
    trackingNumber: "VU464245449GB",
    packages: [{ packageNumber: 1 }],
  };
  eq("order-level trackingNumber is found", extractTrackingNumbers(order), ["VU464245449GB"]);
}

console.log("\nunlabeled order (real shape)");

{
  // Real shape for a not-yet-labeled order: no trackingNumber anywhere.
  const order = {
    orderIdentifier: 1266,
    orderReference: "stripe-zh1S4oOJ",
    packages: [{ packageNumber: 1 }],
  };
  eq("no tracking numbers found", extractTrackingNumbers(order), []);
}

console.log("\nedge cases");

{
  const order = { orderIdentifier: 1, trackingNumber: "AB1GB", packages: [] };
  eq("empty packages array falls back to order-level trackingNumber", extractTrackingNumbers(order), ["AB1GB"]);
}

{
  const order = { orderIdentifier: 1, trackingNumber: "AB1GB" };
  eq("missing packages field falls back to order-level trackingNumber", extractTrackingNumbers(order), ["AB1GB"]);
}

{
  const order = { orderIdentifier: 1, packages: [{ packageNumber: 1 }] };
  eq("no trackingNumber anywhere returns empty array (not undefined in the list)", extractTrackingNumbers(order), []);
}

{
  // Forward-safety: if Click & Drop ever does put a tracking number on a
  // specific package, that should win over the order-level one for that package.
  const order = {
    orderIdentifier: 1,
    trackingNumber: "ORDERLEVEL",
    packages: [{ packageNumber: 1, trackingNumber: "PKG1" }, { packageNumber: 2 }],
  };
  eq(
    "per-package trackingNumber takes precedence; missing packages fall back to order-level",
    extractTrackingNumbers(order),
    ["PKG1", "ORDERLEVEL"]
  );
}

console.log("\nnotification email content");

{
  const html = buildNotificationEmailHtml({
    email: "jane@example.com",
    name: "Jane Smith",
    items: [{ name: "Pedal Plugs", quantity: 1, unitValue: 30 }],
    trackingNumber: "VU464245449GB",
  });
  has("customer name shown", html, "<strong>Jane Smith</strong>'s order");
  has("customer email shown", html, "jane@example.com");
  has("item name and price shown", html, "Pedal Plugs — £30.00");
  has("click-twice note appears before the link", html, "Click this twice");
  eq(
    "click-twice note comes before the tracking link",
    html.indexOf("Click this twice") < html.indexOf(buildTrackingUrl("VU464245449GB")),
    true
  );
  has("tracking link present", html, buildTrackingUrl("VU464245449GB"));
  hasNot("no separate 'Tracking number:' label", html, "Tracking number:");
  hasNot("no order reference field", html, "Order reference");
}

{
  const html = buildNotificationEmailHtml({
    email: "unknown",
    name: null,
    items: [],
    trackingNumber: "VU464245449GB",
  });
  has("falls back to generic phrasing when name is missing", html, "for an order");
  hasNot("no possessive apostrophe when name is missing", html, "'s order");
  hasNot("no item list rendered when items is empty", html, "<ul>");
}

{
  const html = buildNotificationEmailHtml({
    email: "jane@example.com",
    name: "Jane Smith",
    items: [{ name: "Item A", quantity: 2, unitValue: 5 }, { name: "Item B", quantity: 1, unitValue: 12.5 }],
    trackingNumber: "VU1GB",
  });
  has("quantity > 1 prefixed", html, "2x Item A — £5.00");
  has("quantity 1 not prefixed", html, "<li>Item B — £12.50</li>");
}

{
  const html = buildNotificationEmailHtml({
    email: '<script>alert(1)</script>',
    name: "O'Brien & Sons",
    items: [],
    trackingNumber: "VU1GB",
  });
  hasNot("email is HTML-escaped", html, "<script>alert(1)</script>");
  hasNot("name is HTML-escaped", html, "O'Brien & Sons");
  has("escaped name renders safely", html, "O&#39;Brien &amp; Sons");
}

console.log("\nstripe order reference matching");

{
  eq("extracts suffix from stripe- reference", stripeSuffixFromOrderReference("stripe-Xy5xUqwz"), "Xy5xUqwz");
  eq("non-stripe reference returns null", stripeSuffixFromOrderReference("manual-order-1"), null);
  eq("missing reference returns null", stripeSuffixFromOrderReference(undefined), null);
}

console.log("\nextracting order info from a Stripe session");

{
  // Real-ish shape returned by GET /checkout/sessions/{id}?expand[]=line_items&expand[]=line_items.data.price.product
  const session = {
    id: "cs_live_a1b2c3d4e5f6Xy5xUqwz",
    customer_details: { name: "Jane Smith", email: "jane@example.com" },
    collected_information: { shipping_details: { name: "Jane Smith" } },
    metadata: {},
    line_items: {
      data: [
        {
          description: "Jamaican Bacon Clip",
          quantity: 2,
          amount_subtotal: 5000,
          amount_total: 5000,
          price: { id: "price_abc", product: { name: "Jamaican Bacon Clip" } },
        },
      ],
    },
  };
  const info = extractOrderInfoFromSession(session);
  eq("name from shipping_details", info.name, "Jane Smith");
  eq("email from customer_details", info.email, "jane@example.com");
  eq("item name/quantity/unitValue", info.items, [{ name: "Jamaican Bacon Clip", quantity: 2, unitValue: 25 }]);
}

{
  // No shipping details, no customer name — falls back to "unknown" email, null name
  const session = { id: "cs_live_x", customer_details: {}, line_items: { data: [] } };
  const info = extractOrderInfoFromSession(session);
  eq("email falls back to unknown", info.email, "unknown");
  eq("name falls back to null", info.name, null);
  eq("no line items → empty items array", info.items, []);
}

{
  // Variant label from metadata appended, matching buildClickAndDropOrder's convention
  const session = {
    id: "cs_live_x",
    customer_details: { name: "Jo", email: "jo@example.com" },
    metadata: { item_labels: JSON.stringify({ price_abc: "330ml" }) },
    line_items: {
      data: [
        {
          description: "Bottle",
          quantity: 1,
          amount_total: 1000,
          price: { id: "price_abc", product: { name: "Bottle" } },
        },
      ],
    },
  };
  const info = extractOrderInfoFromSession(session);
  eq("variant label appended to item name", info.items[0].name, "Bottle (330ml)");
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
