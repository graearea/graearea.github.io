#!/usr/bin/env node
/**
 * Integration test for the Click & Drop API.
 * Fires a request directly so you can iterate on the payload without
 * going through Stripe webhooks.
 *
 * Usage:
 *   CLICK_AND_DROP_API_KEY=xxx node scripts/test-clickanddrop.js
 *   node scripts/test-clickanddrop.js          # reads key from macOS Keychain
 *
 * Store key in Keychain:
 *   security add-generic-password -a "$USER" -s "clickanddrop-api-key" -w "xxx"
 */

const { execSync } = require("node:child_process");

function getKey() {
  const env = process.env.CLICK_AND_DROP_API_KEY;
  if (env) return env;
  try {
    return execSync(
      `security find-generic-password -a "${process.env.USER}" -s "clickanddrop-api-key" -w`,
      { stdio: ["pipe", "pipe", "pipe"] }
    ).toString().trim();
  } catch {
    console.error("No CLICK_AND_DROP_API_KEY env var and not found in Keychain.");
    console.error('Store it: security add-generic-password -a "$USER" -s "clickanddrop-api-key" -w "xxx"');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Edit this payload to test different field combinations
// ---------------------------------------------------------------------------
// Minimal payload — just the documented required fields, nothing else
const order = {
  orderReference: "test-001",
  orderDate: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  subtotal: 30,
  shippingCostCharged: 4,
  total: 34,
  specialInstructions: "Choose extension size: 15mm20mm",
  recipient: {
    emailAddress: "ianmiller44@outlook.com",
    address: {
      fullName: "Ian Miller",
      addressLine1: "Chesapeake",
      addressLine2: "Crookes Lane, Kewstoke",
      city: "Weston-super-Mare",
      postcode: "BS22 9XF",
      countryCode: "GB",
    },
  },
  packages: [
    {
      weightInGrams: 500,
      packageFormatIdentifier: "parcel",
      contents: [
        {
          name: "Pedal Plugs",
          quantity: 1,
          unitValue: 30,
          unitWeightInGrams: 500,
        },
      ],
    },
  ],
};
// ---------------------------------------------------------------------------

async function main() {
  const key = getKey();

  console.log("POST https://api.parcel.royalmail.com/api/v1/orders");
  console.log("\nPayload:");
  console.log(JSON.stringify({ items: [order] }, null, 2));
  console.log("\n---");

  const res = await fetch("https://api.parcel.royalmail.com/api/v1/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ items: [order] }),
  });

  const text = await res.text();
  console.log(`\nStatus: ${res.status} ${res.statusText}`);
  console.log("Response:");
  try { console.log(JSON.stringify(JSON.parse(text), null, 2)); } catch { console.log(text); }

  if (!res.ok) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
