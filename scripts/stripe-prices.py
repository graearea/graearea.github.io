#!/usr/bin/env python3
"""
Lists all active Stripe prices with their product names and amounts.
Useful for finding price IDs to drop into product pages.

Usage:
    STRIPE_SECRET_KEY=sk_live_xxx python3 scripts/stripe-prices.py
"""

import json
import os
import sys
import urllib.request

STRIPE_BASE = "https://api.stripe.com/v1"


def stripe_get(path, key):
    req = urllib.request.Request(
        f"{STRIPE_BASE}{path}",
        headers={"Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read())
    if "error" in data:
        raise RuntimeError(data["error"]["message"])
    return data


def get_all_pages(path, key):
    items = []
    url = f"{path}&limit=100"
    while url:
        page = stripe_get(url, key)
        items.extend(page["data"])
        if page["has_more"]:
            last_id = page["data"][-1]["id"]
            url = f"{path}&limit=100&starting_after={last_id}"
        else:
            url = None
    return items


def main():
    key = os.environ.get("STRIPE_SECRET_KEY")
    if not key:
        print("Error: STRIPE_SECRET_KEY environment variable not set.", file=sys.stderr)
        print("Usage: STRIPE_SECRET_KEY=sk_live_xxx python3 scripts/stripe-prices.py", file=sys.stderr)
        sys.exit(1)

    print("Fetching prices from Stripe...\n")

    prices = get_all_pages("/prices?active=true&expand[]=data.product", key)

    active = [
        p for p in prices
        if p.get("product") and not p["product"].get("deleted")
    ]
    active.sort(key=lambda p: p["product"]["name"].lower())

    if not active:
        print("No active prices found.")
        return

    col1 = max((len(p["product"]["name"]) for p in active), default=12) + 2
    col2 = max((len(p["id"]) for p in active), default=8) + 2

    header = f"{'Product':<{col1}}{'Price ID':<{col2}}Amount"
    print(header)
    print("-" * (len(header) + 10))

    for price in active:
        name = price["product"]["name"]
        pid = price["id"]
        unit = price.get("unit_amount")
        if unit is not None:
            amount = f"\u00a3{unit / 100:.2f}"
        elif price.get("billing_scheme") == "tiered":
            amount = "(tiered)"
        else:
            amount = "(variable)"
        print(f"{name:<{col1}}{pid:<{col2}}{amount}")

    print(f"\n{len(active)} price(s) found.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
