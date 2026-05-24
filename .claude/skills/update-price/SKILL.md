---
name: update-price
description: Update the price of an existing product. Updates products.json, creates new Stripe prices, and updates the product page.
argument-hint: "[product name] [new price or +/- adjustment]"
---

You are helping update the price of an existing product in the uberniche.co.uk Caterham parts shop.

**Important:** Stripe prices are immutable. You cannot edit an existing price — you must create a new one. The old price ID is simply replaced in the product page; Stripe retains the old price but it will no longer be used.

**Note:** `_site/` is Jekyll's build output and is gitignored. Never edit files in `_site/` — they are regenerated automatically from the `.md` source files on every build/deploy.

## Step 1 — Identify the product and new prices

If not already provided via $ARGUMENTS:
- Ask which product to update
- Ask for the new price(s), or the adjustment (e.g. "+£10")

Read the current prices from `scripts/products.json` and show the user what will change before proceeding.

## Step 2 — Update products.json

Edit `scripts/products.json` to update the `amount` (or `prices[].amount`) for the relevant product(s).

Amounts are in pence (£1.00 = 100).

## Step 3 — Create new Stripe prices

Run the create script. It reads the Stripe key from macOS Keychain automatically:

```bash
python3 scripts/stripe-create-products.py scripts/products.json
```

Parse the output. Find the `[created]` lines for the updated product and extract the new price ID(s) — they look like `price_1Xxxxx...`.

The script is idempotent — existing prices at old amounts are untouched; only new amounts produce new price IDs.

## Step 4 — Update the product page

Find the product's `.md` file in the repo root (e.g. `lifeline-mirror-mounts.md`).

For each button:
- Replace the old `price_xxx` ID with the new one
- Update the price shown in the button label (e.g. `£100` → `£110`)
- Update the `priceInPounds` argument in `addToBasket(...)` to match

Also update the `description:` front matter if it contains a price (e.g. "From £100" → "From £110").

## Step 5 — Confirm and summarise

Show the user:
- Which file(s) were changed
- The old and new prices
- The new Stripe price ID(s)
