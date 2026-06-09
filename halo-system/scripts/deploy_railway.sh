export PATH="$HOME/.railway/bin:$PATH"
#!/usr/bin/env bash
set -euo pipefail

# Helper to set Railway variables from .env and deploy the app.
# Usage: ./scripts/deploy_railway.sh [PROJECT_NAME]

PROJECT_NAME=${1:-haloit-backend}

if ! command -v railway >/dev/null 2>&1; then
  echo "railway CLI is required. Install with: curl -sSL https://railway.app/install.sh | sh"
  exit 1
fi

echo "Using Railway project: $PROJECT_NAME"

# init project if needed (ignore failure if already initialized)
railway init --name "$PROJECT_NAME" || true

if [ -f .env ]; then
  echo "Setting Railway variables from .env (skipping comments/empty lines)"
  while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "${line// /}" || "${line// /}" =~ ^# ]] && continue
    key=${line%%=*}
    val=${line#*=}
    if [[ -n "$key" ]]; then
      echo "railway variables set $key=$val"
      railway variables set "$key" "$val"
    fi
  done < .env
else
  echo ".env not found. Set variables with 'railway variables set KEY VALUE'"
fi

echo "Starting deploy (railway up)"
railway up --detach

echo "Deploy started. Use 'railway logs' to follow logs and 'railway status' for status." 
