#!/usr/bin/env python3
"""
Identifies and optionally archives Stripe products that are not in products.json.

Usage:
    python3 scripts/stripe-archive-orphans.py scripts/products.json          # dry run
    python3 scripts/stripe-archive-orphans.py scripts/products.json --archive # archive orphans

STRIPE_SECRET_KEY can be set in env or stored in macOS Keychain under 'stripe-secret-key'.
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


def stripe_get(path, key, params=None):
    url = f"{STRIPE_BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())


def stripe_post(path, data, key):
    body = urllib.parse.urlencode(data).encode()
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    req = urllib.request.Request(f"{STRIPE_BASE}{path}", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())


def list_all_active_products(key):
    products = []
    params = {"limit": 100, "active": "true"}
    while True:
        page = stripe_get("/products", key, params)
        products.extend(page["data"])
        if not page["has_more"]:
            break
        params["starting_after"] = page["data"][-1]["id"]
    return products


def main():
    archive_mode = "--archive" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    if not args:
        print("Usage: python3 scripts/stripe-archive-orphans.py scripts/products.json [--archive]", file=sys.stderr)
        sys.exit(1)

    with open(args[0]) as f:
        canonical = {item["name"] for item in json.load(f)}

    key = get_key()
    print("Fetching all active Stripe products...")
    stripe_products = list_all_active_products(key)
    print(f"Found {len(stripe_products)} active product(s) in Stripe.")
    print(f"Found {len(canonical)} product(s) in products.json.\n")

    # Group products by name
    by_name = {}
    for p in stripe_products:
        by_name.setdefault(p["name"], []).append(p)

    orphans = []        # name not in products.json at all
    duplicates = []     # extra copies of a valid name (all but the newest)

    for p in stripe_products:
        if p["name"] not in canonical:
            orphans.append(p)

    for name, copies in by_name.items():
        if name in canonical and len(copies) > 1:
            # Keep the newest (first returned by Stripe — Stripe lists newest first)
            duplicates.extend(copies[1:])

    in_sync = [p for p in stripe_products if p["name"] in canonical and p not in duplicates]

    print(f"In sync ({len(in_sync)}):")
    for p in sorted(in_sync, key=lambda x: x["name"]):
        print(f"  ✓  {p['name']}  ({p['id']})")

    print(f"\nOrphaned — active in Stripe but not in products.json ({len(orphans)}):")
    for p in sorted(orphans, key=lambda x: x["name"]):
        print(f"  ✗  {p['name']}  ({p['id']})")

    print(f"\nDuplicates — extra copies of valid products ({len(duplicates)}):")
    for p in sorted(duplicates, key=lambda x: x["name"]):
        print(f"  ~  {p['name']}  ({p['id']})")

    to_archive = orphans + duplicates
    if not to_archive:
        print("\nNothing to do.")
        return

    if not archive_mode:
        print(f"\nDry run — {len(to_archive)} product(s) would be archived ({len(orphans)} orphan(s) + {len(duplicates)} duplicate(s)).")
        print("Re-run with --archive to archive them (sets active=false, fully reversible).")
        print("\nNote: before archiving duplicates, verify no in-use price IDs belong to them.")
        return

    print(f"\nArchiving {len(to_archive)} product(s)...")
    for p in to_archive:
        try:
            stripe_post(f"/products/{p['id']}", {"active": "false"}, key)
            print(f"  Archived: {p['name']}  ({p['id']})")
        except Exception as e:
            print(f"  ERROR archiving {p['name']}: {e}", file=sys.stderr)

    print("\nDone. Archived products can be restored in the Stripe dashboard.")


if __name__ == "__main__":
    main()
