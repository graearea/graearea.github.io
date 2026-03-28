---
name: new-product
description: Add a new product to the shop. Creates the product page, adds it to Stripe, and wires up the buy button.
argument-hint: "[product name]"
---

You are helping add a new product to the uberniche.co.uk Caterham parts shop. Follow these steps in order, checking in with the user at each stage before proceeding.

## Step 1 — Gather details

Ask the user for the following if not already provided via $ARGUMENTS:

- **Product name** (e.g. "Fuel Filler Neck Shims") — used as the page heading and Stripe product name
- **Page filename slug** (e.g. `fuel-neck-shim`) — becomes `<slug>.md` in the repo root
- **Description** — a sentence or two for the Stripe product description
- **Price(s)** — amount(s) in pounds including P&P. If there are multiple variants (e.g. with/without mirrors, two sizes), collect a label and price for each
- **Image filename** — the image should already be in the `img/` directory. Ask what it's called, then verify the file exists with Glob at `img/<filename>`
- **Page copy** — ask the user what they want the page to say, or offer to draft something based on the product name and description

Do not proceed until you have all of the above.

## Step 2 — Create the product page

Create `<slug>.md` in the repo root. Follow the exact pattern used by existing product pages:

- Use `# Product Name` as the H1
- Include `![alt](img/<filename>)` for the image
- Include the product description and any fitting notes the user provides
- Add the buy button(s) using the standard pattern below — use `PRICE_ID_PLACEHOLDER` for now (real IDs come in Step 4)
- End with `{% include_relative delivery.md %}`

**Single price button pattern:**
```html
<button onclick="checkout(this, 'PRICE_ID_PLACEHOLDER')">Buy – £XX delivered</button>

<script>
async function checkout(btn, priceId) {
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'Loading...';
  const res = await fetch('https://autumn-bread-f290.uber-niche-parts.workers.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId })
  });
  const { url } = await res.json();
  if (url) {
    window.location.href = url;
  } else {
    alert('Something went wrong, please try again.');
    btn.disabled = false;
    btn.textContent = orig;
  }
}
</script>
```

**Multiple price buttons:** use multiple `<button>` elements with descriptive labels before a single shared `<script>` block.

Show the user the draft page and ask them to confirm before continuing.

## Step 3 — Add to products.json

Read `scripts/products.json`. Append a new entry for this product following the existing format:

- Single price: `{ "name": "...", "description": "...", "amount": <pence>, "currency": "gbp" }`
- Multiple prices: use the `"prices": [{ "label": "...", "amount": <pence> }, ...]` format

Amounts are in pence (£1.00 = 100). Write the updated file.

## Step 4 — Create in Stripe and get price IDs

Run the create script. It reads the key from macOS Keychain automatically:

```bash
python3 scripts/stripe-create-products.py scripts/products.json
```

Parse the output carefully. Find the lines for the new product and extract the price ID(s) — they look like `price_1Xxxxx...`.

Note: the script is idempotent so existing products will not be duplicated.

## Step 5 — Update the product page with real price IDs

Replace each `PRICE_ID_PLACEHOLDER` in the new product page with the real price ID(s) from Step 4. Update the button text to match the exact Stripe amount if it differs from what was written.

## Step 6 — Confirm and summarise

Show the user:
- The final product page content
- The Stripe price ID(s) that were created
- A reminder that the page needs to be linked from `index.md` if it should appear in the shop listing

Ask if they want you to add it to the index page.
