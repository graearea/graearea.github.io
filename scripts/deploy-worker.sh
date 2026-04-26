#!/bin/bash
# Deploy the checkout Cloudflare Worker.
# Run from repo root: bash scripts/deploy-worker.sh
# Or the webhook worker: bash scripts/deploy-worker.sh webhook
set -e

cd "$(dirname "$0")/../cloudflare"

if [ "$1" = "webhook" ]; then
  echo "Deploying webhook worker..."
  npx wrangler deploy --config wrangler-webhook.toml
else
  echo "Deploying checkout worker..."
  npx wrangler deploy
fi
