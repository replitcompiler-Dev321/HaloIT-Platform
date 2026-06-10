#!/usr/bin/env bash
set -euo pipefail

# Simple helper to deploy this backend to Fly.io.
# Usage: APP_NAME=my-app ./scripts/deploy_fly.sh

APP_NAME=${APP_NAME:-haloitservices365-backend}

if ! command -v flyctl >/dev/null 2>&1; then
  echo "flyctl is required. Install from https://fly.io/docs/hands-on/install-flyctl/"
  exit 1
fi

echo "Using Fly app name: $APP_NAME"

# Create app if it doesn't exist (ignore failure if exists)
flyctl apps create "$APP_NAME" || true

# Upload environment variables as secrets from .env (simple KEY=VALUE parser)
if [ -f .env ]; then
  echo "Uploading secrets from .env to Fly (skipping commented/empty lines)"
  while IFS= read -r line || [ -n "$line" ]; do
    # skip empty or comment lines
    [[ -z "$line" || "${line#[[:space:]]}" =~ ^# ]] && continue
    key=${line%%=*}
    val=${line#*=}
    if [[ -n "$key" ]]; then
      echo "Setting secret: $key"
      flyctl secrets set "$key=$val"
    fi
  done < .env
else
  echo ".env file not found — set required secrets with 'flyctl secrets set KEY=VALUE'"
fi

echo "Deploying to Fly.io (this will build using the Dockerfile)"
flyctl deploy --app "$APP_NAME" --remote-only

echo "Deployment complete. Use 'flyctl status --app $APP_NAME' to inspect." 
