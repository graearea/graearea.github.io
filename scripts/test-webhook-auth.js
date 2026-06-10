#!/usr/bin/env node
/**
 * Integration tests for the Stripe webhook worker's signature verification.
 *
 * Covers spec obligations in specs/shop.allium:
 *   rule PaymentCompleted — requires event.signature_valid
 *   rule PaymentCompleted — requires event.age <= config.webhook_max_age (5 minutes)
 *   rule PaymentCompleted — wrong event type is ignored, not rejected
 *   surface WebhookWorker — ReplayProtection guarantee
 *
 * These tests post to the LIVE webhook worker. Valid-signature tests use the
 * webhook secret from the macOS Keychain (or STRIPE_WEBHOOK_SECRET env var).
 * No actual Stripe payments are triggered.
 *
 * Usage:
 *   node scripts/test-webhook-auth.js
 *   STRIPE_WEBHOOK_SECRET=whsec_xxx node scripts/test-webhook-auth.js
 *
 * Store secret in Keychain:
 *   security add-generic-password -a "$USER" -s "stripe-webhook-secret" -w "whsec_xxx"
 *
 * WEBHOOK_WORKER_URL defaults to the workers.dev URL. Override if the worker uses
 * a custom domain:
 *   WEBHOOK_WORKER_URL=https://... node scripts/test-webhook-auth.js
 */

"use strict";

const { execSync } = require("node:child_process");

const WEBHOOK_WORKER_URL =
  process.env.WEBHOOK_WORKER_URL ||
  "https://webhook-worker.uber-niche-parts.workers.dev/";

function getWebhookSecret() {
  const env = process.env.STRIPE_WEBHOOK_SECRET;
  if (env) return env;
  try {
    return execSync(
      `security find-generic-password -a "${process.env.USER}" -s "stripe-webhook-secret" -w`,
      { stdio: ["pipe", "pipe", "pipe"] }
    ).toString().trim();
  } catch {
    return null;
  }
}

// Construct a Stripe-compatible webhook signature header.
// Mirrors the algorithm in verifyStripeSignature in cloudflare/webhook-worker.js.
async function signPayload(body, secret, overrideTimestamp) {
  const timestamp = overrideTimestamp ?? Math.floor(Date.now() / 1000);
  // Stripe webhook secrets are base64-encoded after the "whsec_" prefix
  const rawSecret = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedPayload = `${timestamp}.${body}`;
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    rawSecret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    Buffer.from(signedPayload, "utf8")
  );
  const hex = Buffer.from(sig).toString("hex");
  return `t=${timestamp},v1=${hex}`;
}

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
  console.log(`\nWebhook worker URL: ${WEBHOOK_WORKER_URL}`);

  console.log("\nwebhook worker — method handling");

  await check("GET returns 405", async () => {
    const res = await fetch(WEBHOOK_WORKER_URL, { method: "GET" });
    assert(res.status === 405, `expected 405, got ${res.status}`);
  });

  console.log("\nwebhook worker — signature verification (no secret required)");

  await check("missing stripe-signature header returns 401", async () => {
    const body = JSON.stringify({ type: "payment_intent.created", data: { object: {} } });
    const res = await fetch(WEBHOOK_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  await check("malformed stripe-signature header returns 401", async () => {
    const body = JSON.stringify({ type: "payment_intent.created", data: { object: {} } });
    const res = await fetch(WEBHOOK_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": "not-a-valid-sig" },
      body,
    });
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  await check("plausible-looking but wrong signature returns 401", async () => {
    const body = JSON.stringify({ type: "payment_intent.created", data: { object: {} } });
    const ts = Math.floor(Date.now() / 1000);
    const res = await fetch(WEBHOOK_WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": `t=${ts},v1=aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899`,
      },
      body,
    });
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  // ---------------------------------------------------------------------------
  // Tests that require the webhook secret
  // ---------------------------------------------------------------------------

  const secret = getWebhookSecret();

  if (!secret) {
    console.log("\n⚠ Skipping signed-request tests — webhook secret not found.");
    console.log('  Store it: security add-generic-password -a "$USER" -s "stripe-webhook-secret" -w "whsec_xxx"');
    console.log("  Or:       STRIPE_WEBHOOK_SECRET=whsec_xxx node scripts/test-webhook-auth.js");
  } else {
    console.log("\nwebhook worker — signed requests");

    await check("valid signature + non-checkout event type returns 200 Ignored", async () => {
      const body = JSON.stringify({ type: "payment_intent.created", data: { object: {} } });
      const sig = await signPayload(body, secret);
      const res = await fetch(WEBHOOK_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": sig },
        body,
      });
      assert(res.status === 200, `expected 200, got ${res.status}`);
      const text = await res.text();
      assert(text === "Ignored", `expected body "Ignored", got "${text}"`);
    });

    await check("valid signature + timestamp > 5 minutes old returns 401 (replay protection)", async () => {
      const staleTimestamp = Math.floor(Date.now() / 1000) - 310; // 5 min 10 sec ago
      const body = JSON.stringify({ type: "payment_intent.created", data: { object: {} } });
      const sig = await signPayload(body, secret, staleTimestamp);
      const res = await fetch(WEBHOOK_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": sig },
        body,
      });
      assert(res.status === 401, `expected 401 for stale event, got ${res.status}`);
    });

    await check("valid signature + checkout.session.completed returns 200 even if Stripe fetch fails", async () => {
      // The worker verifies the signature, then calls Stripe to expand the session.
      // A fake session ID causes a Stripe error which the worker catches inside the
      // try/catch around the C&D call — so it still returns 200 to prevent Stripe
      // retrying a completed payment. If this returns 500, the worker has an unhandled
      // crash before or outside the try/catch.
      const body = JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { id: "cs_test_fakefakefakefakefakefakefakefakefake" } },
      });
      const sig = await signPayload(body, secret);
      const res = await fetch(WEBHOOK_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": sig },
        body,
      });
      assert(res.status === 200, `expected 200 (worker swallows downstream errors), got ${res.status}`);
    });
  }

  console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
