#!/usr/bin/env python3
"""
Syncs weightInGrams from products.json into Stripe product metadata.

Usage:
    python3 scripts/sync-weights.py scripts/products.json

Matches products by name (case-insensitive). Skips any that can't be matched.
Reads the Stripe key from the environment or macOS Keychain (same as stripe-create-products.py).
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request


def get_key():
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
        sys.exit(1)


STRIPE_BASE = "https://api.stripe.com/v1"


def stripe_get(path, key):
    req = urllib.request.Request(
        f"{STRIPE_BASE}{path}",
        headers={"Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())


def stripe_post(path, data, key):
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(
        f"{STRIPE_BASE}{path}",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())


def fetch_all_stripe_products(key):
    products = []
    url = "/products?limit=100&active=true"
    while url:
        page = stripe_get(url, key)
        products.extend(page["data"])
        url = f"/products?limit=100&starting_after={page['data'][-1]['id']}" if page.get("has_more") else None
    return products


def main():
    key = get_key()

    input_file = sys.argv[1] if len(sys.argv) > 1 else "scripts/products.json"
    with open(input_file) as f:
        local_products = json.load(f)

    print("Fetching Stripe products...")
    stripe_products = fetch_all_stripe_products(key)
    stripe_by_name = {p["name"].lower(): p for p in stripe_products}

    matched = skipped = 0
    for item in local_products:
        weight = item.get("weightInGrams")
        if weight is None:
            continue
        name = item["name"]
        stripe_product = stripe_by_name.get(name.lower())
        if not stripe_product:
            print(f"  SKIP (not found in Stripe): {name}")
            skipped += 1
            continue
        current = stripe_product.get("metadata", {}).get("weightInGrams")
        if str(current) == str(weight):
            print(f"  OK   (already {weight}g): {name}")
            matched += 1
            continue
        stripe_post(f"/products/{stripe_product['id']}", {"metadata[weightInGrams]": str(weight)}, key)
        print(f"  SET  {weight}g: {name}")
        matched += 1

    print(f"\nDone. {matched} updated/confirmed, {skipped} skipped (not in Stripe).")


if __name__ == "__main__":
    main()
