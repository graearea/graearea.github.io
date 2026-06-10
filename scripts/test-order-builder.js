#!/usr/bin/env node
/**
 * Unit tests for buildClickAndDropOrder.
 *
 * Covers spec obligations in specs/shop.allium:
 *   rule CreateShipment — order_ref format, special instructions, weight,
 *   address mapping, custom fields, multi-item baskets, fallback weight.
 *
 * No external calls — all pure function tests.
 *
 * IMPORTANT: This inlines buildClickAndDropOrder from cloudflare/webhook-worker.js.
 * Keep this copy in sync when the worker changes.
 */

"use strict";

// ---------------------------------------------------------------------------
// Inlined from cloudflare/webhook-worker.js
// ---------------------------------------------------------------------------

function buildClickAndDropOrder(session, shipping) {
  const addr = shipping.address;
  const name = shipping.name || session.customer_details?.name || "Unknown";
  const email = session.customer_details?.email;

  const subtotal = (session.amount_subtotal ?? session.amount_total) / 100;
  const shippingCost = (session.shipping_cost?.amount_total ?? 0) / 100;
  const total = session.amount_total / 100;

  const orderRef = `stripe-${session.id.slice(-8)}`;
  const orderDate = new Date(session.created * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

  let itemLabels = {};
  try { itemLabels = JSON.parse(session.metadata?.item_labels ?? "{}"); } catch {}

  const lineItems = session.line_items?.data ?? [];
  const contents = lineItems.map((item) => {
    const label = itemLabels[item.price?.id];
    const baseName = item.description || item.price?.product?.name || "Item";
    return {
      name: label ? `${baseName} (${label})` : baseName,
      quantity: item.quantity,
      unitValue: Math.round((item.amount_subtotal ?? item.amount_total) / item.quantity) / 100,
      unitWeightInGrams: parseInt(item.price?.product?.metadata?.weightInGrams ?? 500, 10),
    };
  });

  const itemSummaryParts = contents.map((c) =>
    c.quantity > 1 ? `${c.quantity}x ${c.name}` : c.name
  );
  const customFields = session.custom_fields ?? [];
  const customFieldParts = customFields
    .map((f) => {
      const label = f.label?.custom ?? f.key;
      const value = f.type === "dropdown" ? f.dropdown?.value : f.text?.value;
      return value ? `${label}: ${value}` : null;
    })
    .filter(Boolean);
  const allInstructionParts = [...itemSummaryParts, ...customFieldParts];
  const specialInstructions = allInstructionParts.length
    ? allInstructionParts.join(" | ").slice(0, 500)
    : undefined;

  const pkg = {
    weightInGrams: contents.length
      ? contents.reduce((sum, i) => sum + i.unitWeightInGrams * i.quantity, 0)
      : 500,
    packageFormatIdentifier: "smallParcel",
  };
  if (contents.length) pkg.contents = contents;

  return {
    orderReference: orderRef,
    orderDate,
    subtotal,
    shippingCostCharged: shippingCost,
    total,
    ...(specialInstructions && { specialInstructions }),
    recipient: {
      ...(email && { emailAddress: email }),
      address: {
        fullName: name,
        addressLine1: addr.line1,
        ...(addr.line2 && { addressLine2: addr.line2 }),
        city: addr.city,
        ...(addr.state && { county: addr.state }),
        postcode: addr.postal_code,
        countryCode: addr.country,
      },
    },
    packages: [pkg],
    postageDetails: {
      serviceCode: "TOLP48",
      sendNotificationsTo: "recipient",
      receiveEmailNotification: true,
    },
  };
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
// Fixtures
// ---------------------------------------------------------------------------

const baseShipping = {
  name: "Jane Smith",
  address: {
    line1: "10 Downing Street",
    line2: null,
    city: "London",
    state: null,
    postal_code: "SW1A 2AA",
    country: "GB",
  },
};

const baseSession = {
  id: "cs_live_a1b2c3d4e5f6g7h8",
  created: 1700000000,
  amount_subtotal: 2500,
  amount_total: 2900,
  shipping_cost: { amount_total: 400 },
  customer_details: { name: "Jane Smith", email: "jane@example.com" },
  line_items: {
    data: [
      {
        description: "Jamaican Bacon Clip",
        quantity: 1,
        amount_subtotal: 2500,
        amount_total: 2500,
        price: {
          id: "price_abc",
          product: {
            name: "Jamaican Bacon Clip",
            metadata: { weightInGrams: "50" },
          },
        },
      },
    ],
  },
  custom_fields: [],
  metadata: {},
};

// ---------------------------------------------------------------------------
// Tests: order reference (spec: rule CreateShipment, order_ref format)
// ---------------------------------------------------------------------------

console.log("\norder reference");

{
  const order = buildClickAndDropOrder(baseSession, baseShipping);
  eq(
    'order_ref is "stripe-" + last 8 chars of session ID',
    order.orderReference,
    "stripe-e5f6g7h8"
  );
}

{
  const session = { ...baseSession, id: "cs_live_ABCDEFGH" };
  const order = buildClickAndDropOrder(session, baseShipping);
  eq("last 8 chars extracted correctly for short-ish ID", order.orderReference, "stripe-ABCDEFGH");
}

// ---------------------------------------------------------------------------
// Tests: amounts (pence → GBP)
// ---------------------------------------------------------------------------

console.log("\namount conversion");

{
  const order = buildClickAndDropOrder(baseSession, baseShipping);
  eq("subtotal in GBP", order.subtotal, 25);
  eq("shipping in GBP", order.shippingCostCharged, 4);
  eq("total in GBP", order.total, 29);
}

{
  const session = { ...baseSession, shipping_cost: undefined, amount_subtotal: undefined };
  const order = buildClickAndDropOrder(session, baseShipping);
  eq("no shipping_cost → 0", order.shippingCostCharged, 0);
  eq("no amount_subtotal → falls back to amount_total", order.subtotal, 29);
}

// ---------------------------------------------------------------------------
// Tests: address mapping
// ---------------------------------------------------------------------------

console.log("\naddress mapping");

{
  const order = buildClickAndDropOrder(baseSession, baseShipping);
  eq("fullName from shipping.name", order.recipient.address.fullName, "Jane Smith");
  eq("addressLine1", order.recipient.address.addressLine1, "10 Downing Street");
  eq("city", order.recipient.address.city, "London");
  eq("postcode", order.recipient.address.postcode, "SW1A 2AA");
  eq("countryCode", order.recipient.address.countryCode, "GB");
  eq("addressLine2 omitted when null", "addressLine2" in order.recipient.address, false);
  eq("county omitted when null", "county" in order.recipient.address, false);
  eq("emailAddress from customer_details", order.recipient.emailAddress, "jane@example.com");
}

{
  const shipping = {
    name: "John Doe",
    address: { ...baseShipping.address, line2: "Flat 2", state: "Surrey" },
  };
  const order = buildClickAndDropOrder(baseSession, shipping);
  eq("addressLine2 present when set", order.recipient.address.addressLine2, "Flat 2");
  eq("county from state", order.recipient.address.county, "Surrey");
}

{
  const session = { ...baseSession, customer_details: { name: "Jane Smith" } };
  const order = buildClickAndDropOrder(session, baseShipping);
  eq("emailAddress omitted when absent", "emailAddress" in order.recipient, false);
}

{
  const shipping = { name: null, address: baseShipping.address };
  const session = { ...baseSession, customer_details: { name: "Fallback Name", email: "f@example.com" } };
  const order = buildClickAndDropOrder(session, shipping);
  eq("fullName falls back to customer_details.name when shipping.name is null", order.recipient.address.fullName, "Fallback Name");
}

// ---------------------------------------------------------------------------
// Tests: special instructions (spec: rule CreateShipment, notes)
// ---------------------------------------------------------------------------

console.log("\nspecial instructions");

{
  const order = buildClickAndDropOrder(baseSession, baseShipping);
  eq("single item with no label → just product name", order.specialInstructions, "Jamaican Bacon Clip");
}

{
  const session = {
    ...baseSession,
    metadata: { item_labels: JSON.stringify({ price_abc: "330ml" }) },
  };
  const order = buildClickAndDropOrder(session, baseShipping);
  eq("variant label appended in parens", order.specialInstructions, "Jamaican Bacon Clip (330ml)");
}

{
  const session = {
    ...baseSession,
    line_items: {
      data: [{ ...baseSession.line_items.data[0], quantity: 3, amount_subtotal: 4500, amount_total: 4500 }],
    },
  };
  const order = buildClickAndDropOrder(session, baseShipping);
  eq("quantity > 1 prefixed with count", order.specialInstructions, "3x Jamaican Bacon Clip");
}

{
  const session = {
    ...baseSession,
    custom_fields: [
      { key: "notes", label: { custom: "Notes" }, type: "text", text: { value: "Please use red filament" } },
    ],
  };
  const order = buildClickAndDropOrder(session, baseShipping);
  eq("custom field appended to instructions", order.specialInstructions, "Jamaican Bacon Clip | Notes: Please use red filament");
}

{
  const session = {
    ...baseSession,
    custom_fields: [
      { key: "size", label: { custom: "Size" }, type: "dropdown", dropdown: { value: "Large" } },
    ],
  };
  const order = buildClickAndDropOrder(session, baseShipping);
  eq("dropdown custom field value used", order.specialInstructions, "Jamaican Bacon Clip | Size: Large");
}

{
  const session = {
    ...baseSession,
    custom_fields: [
      { key: "notes", label: { custom: "Notes" }, type: "text", text: { value: null } },
    ],
  };
  const order = buildClickAndDropOrder(session, baseShipping);
  eq("empty custom field value omitted", order.specialInstructions, "Jamaican Bacon Clip");
}

{
  const session = { ...baseSession, line_items: { data: [] } };
  const order = buildClickAndDropOrder(session, baseShipping);
  eq("no line items → no specialInstructions", order.specialInstructions, undefined);
}

{
  const longName = "A".repeat(510);
  const session = {
    ...baseSession,
    line_items: { data: [{ ...baseSession.line_items.data[0], description: longName }] },
  };
  const order = buildClickAndDropOrder(session, baseShipping);
  eq("specialInstructions truncated at 500 chars", order.specialInstructions.length, 500);
}

// ---------------------------------------------------------------------------
// Tests: weight calculation (spec: config default_weight_grams)
// ---------------------------------------------------------------------------

console.log("\nweight calculation");

{
  const order = buildClickAndDropOrder(baseSession, baseShipping);
  eq("weight from product metadata", order.packages[0].weightInGrams, 50);
}

{
  const session = {
    ...baseSession,
    line_items: {
      data: [
        {
          ...baseSession.line_items.data[0],
          quantity: 2,
          price: { id: "p1", product: { name: "Item", metadata: { weightInGrams: "150" } } },
        },
      ],
    },
  };
  const order = buildClickAndDropOrder(session, baseShipping);
  eq("weight multiplied by quantity", order.packages[0].weightInGrams, 300);
}

{
  const session = {
    ...baseSession,
    line_items: {
      data: [
        {
          ...baseSession.line_items.data[0],
          price: { id: "p1", product: { name: "Item", metadata: {} } },
        },
      ],
    },
  };
  const order = buildClickAndDropOrder(session, baseShipping);
  eq("defaults to 500g when no weightInGrams metadata", order.packages[0].weightInGrams, 500);
}

{
  const session = { ...baseSession, line_items: { data: [] } };
  const order = buildClickAndDropOrder(session, baseShipping);
  eq("no line items → fallback 500g package", order.packages[0].weightInGrams, 500);
  eq("no line items → contents omitted", "contents" in order.packages[0], false);
}

// ---------------------------------------------------------------------------
// Tests: postage
// ---------------------------------------------------------------------------

console.log("\npostage");

{
  const order = buildClickAndDropOrder(baseSession, baseShipping);
  eq("service code is TOLP48", order.postageDetails.serviceCode, "TOLP48");
  eq("notifications sent to recipient", order.postageDetails.sendNotificationsTo, "recipient");
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
