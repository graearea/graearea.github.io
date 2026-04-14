#!/usr/bin/env python3
"""
Creates products and prices in Stripe from a JSON input file.

Usage:
    STRIPE_SECRET_KEY=sk_live_xxx python3 scripts/stripe-create-products.py scripts/products.json

Input file format (products.json):
    [
      {
        "name": "My Product",
        "description": "Optional description",
        "amount": 2000,
        "currency": "gbp"
      },
      {
        "name": "Product with variants",
        "description": "One product, two prices",
        "prices": [
          { "label": "Without mirrors", "amount": 10000 },
          { "label": "With mirrors",    "amount": 15000 }
        ],
        "currency": "gbp"
      }
    ]

Notes:
  - amounts are in pence (£1.00 = 100)
  - currency defaults to "gbp" if omitted
  - idempotency keys are derived from product name + amount so re-running
    the script won't create duplicates
  - if a product has a single price, use "amount"; for multiple prices use "prices"
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request


def get_key():
    """Read STRIPE_SECRET_KEY from env, falling back to macOS Keychain."""
    key = os.environ.get("STRIPE_SECRET_KEY")
    if key:
        return key
    try:
        result = subprocess.run(
            ["security", "find-generic-password", "-a", os.environ["USER"], "-s", "stripe-secret-key", "-w"],
            capture_output=True, text=True, check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        print("Error: STRIPE_SECRET_KEY not set and not found in macOS Keychain.", file=sys.stderr)
        print("Store it with:", file=sys.stderr)
        print('  security add-generic-password -a "$USER" -s "stripe-secret-key" -w "sk_live_xxx"', file=sys.stderr)
        sys.exit(1)

STRIPE_BASE = "https://api.stripe.com/v1"


def stripe_get(path, key, params=None):
    url = f"{STRIPE_BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as e:
        result = json.loads(e.read())
        raise RuntimeError(result.get("error", {}).get("message", str(e)))


def stripe_post(path, data, key):
    body = urllib.parse.urlencode(data).encode()
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    req = urllib.request.Request(f"{STRIPE_BASE}{path}", data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as res:
            result = json.loads(res.read())
    except urllib.error.HTTPError as e:
        result = json.loads(e.read())
        raise RuntimeError(result.get("error", {}).get("message", str(e)))

    if "error" in result:
        raise RuntimeError(result["error"]["message"])
    return result


def load_existing_products(key):
    """Return a dict of {name: product_id} for all active Stripe products."""
    existing = {}
    params = {"limit": 100, "active": "true"}
    while True:
        page = stripe_get("/products", key, params)
        for p in page["data"]:
            # Keep the first one found if duplicates exist (oldest wins)
            existing.setdefault(p["name"], p["id"])
        if not page["has_more"]:
            break
        params["starting_after"] = page["data"][-1]["id"]
    return existing


def load_existing_prices(key):
    """Return a set of (product_id, amount, currency, label) for all active prices."""
    existing = set()
    params = {"limit": 100, "active": "true", "expand[]": "data.product"}
    while True:
        page = stripe_get("/prices", key, params)
        for p in page["data"]:
            existing.add((p["product"]["id"] if isinstance(p["product"], dict) else p["product"],
                          p["unit_amount"], p["currency"], p.get("nickname") or ""))
        if not page["has_more"]:
            break
        params["starting_after"] = page["data"][-1]["id"]
    return existing


def create_product(name, description, key):
    data = {"name": name}
    if description:
        data["description"] = description
    return stripe_post("/products", data, key)


def update_product_image(product_id, image_url, key):
    stripe_post(f"/products/{product_id}", {"images[]": image_url}, key)


def create_price(product_id, amount, currency, label, key):
    data = {
        "product": product_id,
        "unit_amount": str(amount),
        "currency": currency,
    }
    if label:
        data["nickname"] = label
    return stripe_post("/prices", data, key)


def main():
    key = get_key()

    if len(sys.argv) < 2:
        print("Error: no input file specified.", file=sys.stderr)
        print("Usage: ... python3 scripts/stripe-create-products.py <products.json>", file=sys.stderr)
        sys.exit(1)

    input_file = sys.argv[1]
    with open(input_file) as f:
        products = json.load(f)

    print(f"Syncing {len(products)} product(s) to Stripe...\n")
    print("  Loading existing products and prices from Stripe...")
    existing_products = load_existing_products(key)
    existing_prices = load_existing_prices(key)
    print(f"  Found {len(existing_products)} existing product(s), {len(existing_prices)} existing price(s).\n")

    results = []
    errors = []

    for item in products:
        name = item["name"]
        description = item.get("description", "")
        currency = item.get("currency", "gbp")
        image_url = item.get("image")

        # Normalise to a list of prices
        if "prices" in item:
            price_list = [(p["label"], p["amount"]) for p in item["prices"]]
        else:
            price_list = [(item.get("label", ""), item["amount"])]

        try:
            if name in existing_products:
                product_id = existing_products[name]
                print(f"  Product: {name} ({product_id})  [exists]")
            else:
                product = create_product(name, description, key)
                product_id = product["id"]
                print(f"  Product: {name} ({product_id})  [created]")

            if image_url:
                update_product_image(product_id, image_url, key)
                print(f"    Image:   {image_url}")

            for label, amount in price_list:
                key_tuple = (product_id, amount, currency, label)
                if key_tuple in existing_prices:
                    # Find the price_id for display — fetch it from Stripe
                    print(f"    Price [{label}]: (exists)  £{amount / 100:.2f}")
                    # We don't have the price_id here so we skip adding to results
                    continue
                price = create_price(product_id, amount, currency, label, key)
                price_id = price["id"]
                display = f"£{amount / 100:.2f}"
                tag = f" [{label}]" if label else ""
                print(f"    Price{tag}: {price_id}  {display}  [created]")
                results.append((name, label, price_id, amount))

        except RuntimeError as e:
            print(f"  ERROR creating '{name}': {e}", file=sys.stderr)
            errors.append((name, str(e)))

    print(f"\nDone. {len(results)} price(s) created, {len(errors)} error(s).")

    if results:
        print("\nSummary — paste these price IDs into your product pages:\n")
        col1 = max(len(r[0]) for r in results) + 2
        col2 = max(len(r[1]) for r in results) + 2 if any(r[1] for r in results) else 0
        col3 = max(len(r[2]) for r in results) + 2
        for name, label, price_id, amount in results:
            n = name.ljust(col1)
            l = label.ljust(col2) if col2 else ""
            p = price_id.ljust(col3)
            print(f"  {n}{l}{p}£{amount / 100:.2f}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
