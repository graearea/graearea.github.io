#!/usr/bin/env node
/**
 * Probes the Click & Drop API - lists recent orders with full details
 * to discover service codes used by the account.
 *
 * Usage: node scripts/probe-clickanddrop.js
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
    process.exit(1);
  }
}

async function main() {
  const key = getKey();
  const headers = { Authorization: `Bearer ${key}` };

  // Fetch orders with full postage details
  const res = await fetch("https://api.parcel.royalmail.com/api/v1/orders/full?take=10", { headers });
  const text = await res.text();
  console.log(`GET /orders/full — Status: ${res.status}`);
  try {
    const d = JSON.parse(text);
    const orders = d.orders ?? d;
    for (const o of (Array.isArray(orders) ? orders : [orders])) {
      const sc = o.postageDetails?.serviceCode ?? o.serviceCode ?? "(none)";
      const svc = o.postageDetails?.shippingService ?? o.shippingService ?? "";
      console.log(`  order ${o.orderIdentifier} | serviceCode: ${sc} | service: ${svc}`);
    }
  } catch {
    console.log(text.slice(0, 500));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
