#!/usr/bin/env node
/**
 * Unit tests for extractTrackingNumbers (cloudflare/tracking-notifier.js).
 *
 * Fixtures are based on real responses pulled from GET /orders on the live
 * Click & Drop account: trackingNumber lives on the order object, never on
 * entries in `packages` (those only ever carry a packageNumber). A prior bug
 * assumed the opposite — checked `pkg.trackingNumber` first and skipped the
 * order-level fallback whenever `packages` was non-empty, which it always is
 * — so every poll found 0 tracking numbers despite labels being printed.
 *
 * No external calls — all pure function tests.
 *
 * IMPORTANT: This inlines extractTrackingNumbers from cloudflare/tracking-notifier.js.
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

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
