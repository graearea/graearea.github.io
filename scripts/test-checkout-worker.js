#!/usr/bin/env node
/**
 * Integration tests for the Stripe checkout worker.
 *
 * Covers spec obligations in specs/shop.allium:
 *   rule InitiateCheckout — empty basket rejected, valid basket returns session URL
 *   surface CheckoutWorker — SessionCreationAuthenticity guarantee
 *   surface CheckoutWorker — CORS preflight (OPTIONS)
 *
 * These tests call the LIVE production worker and create real (uncompleted) Stripe
 * checkout sessions. Uncompleted sessions expire automatically and are not charged.
 *
 * Usage:
 *   node scripts/test-checkout-worker.js
 *   TEST_PRICE_ID=price_xxx node scripts/test-checkout-worker.js
 *
 * Find a price ID: STRIPE_SECRET_KEY=sk_live_xxx python3 scripts/stripe-prices.py
 */

"use strict";

const WORKER_URL = "https://uberniche.co.uk/api/checkout";

// A real Stripe price ID from the catalogue. Override with any active price from
// `STRIPE_SECRET_KEY=sk_live_xxx python3 scripts/stripe-prices.py`
const TEST_PRICE_ID = process.env.TEST_PRICE_ID || "price_1TM6otAhb23PF7gKgXPvKIy1";

let pass = 0, fail = 0;

async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    pass++;
  } catch (err) {
    console.log(`  ✗ ${label}`);
    console.log(`      ${err.message}`);
    fail++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log("\ncheckout worker — method handling");

  await check("OPTIONS returns 204 (CORS preflight)", async () => {
    const res = await fetch(WORKER_URL, { method: "OPTIONS" });
    assert(res.status === 204, `expected 204, got ${res.status}`);
  });

  await check("GET returns 405 (method not allowed)", async () => {
    const res = await fetch(WORKER_URL, { method: "GET" });
    assert(res.status === 405, `expected 405, got ${res.status}`);
  });

  console.log("\ncheckout worker — request validation");

  await check("empty items array returns 400", async () => {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] }),
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
    const body = await res.json();
    assert(body.error, "expected error field in response");
  });

  await check("missing items field returns 400", async () => {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  console.log("\ncheckout worker — session creation (live Stripe)");

  await check("valid price ID returns a session URL", async () => {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ priceId: TEST_PRICE_ID, quantity: 1 }],
      }),
    });
    if (res.status === 500) {
      const body = await res.json();
      if (body.detail?.error?.code === "resource_missing") {
        throw new Error(
          `TEST_PRICE_ID "${TEST_PRICE_ID}" not found in Stripe. ` +
          "Set TEST_PRICE_ID=price_xxx to a real price from: " +
          "STRIPE_SECRET_KEY=sk_live_xxx python3 scripts/stripe-prices.py"
        );
      }
      throw new Error(`Worker returned 500: ${JSON.stringify(body)}`);
    }
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.url, "expected url in response");
    assert(body.url.startsWith("https://checkout.stripe.com/"), `expected Stripe URL, got: ${body.url}`);
    console.log(`      session URL: ${body.url.slice(0, 60)}…`);
  });

  await check("price_data item (variant with inline amount) returns session URL", async () => {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            priceId: "custom-item",
            name: "Test Custom Work",
            label: "Test variant",
            amount: 500,   // £5 in pence
            quantity: 1,
          },
        ],
      }),
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.url?.startsWith("https://checkout.stripe.com/"), "expected Stripe URL");
  });

  await check("CORS headers present on POST response", async () => {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] }),
    });
    const origin = res.headers.get("access-control-allow-origin");
    assert(origin === "*", `expected CORS *, got: ${origin}`);
  });

  console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log("\nNote: session creation tests require a valid TEST_PRICE_ID.");
    console.log("Get one: STRIPE_SECRET_KEY=sk_live_xxx python3 scripts/stripe-prices.py");
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
