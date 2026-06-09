
#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir/../backend"

RAILWAY_BIN="$HOME/.railway/bin/railway"
if [ -x "$RAILWAY_BIN" ]; then
  export PATH="$HOME/.railway/bin:$PATH"
else
  echo "railway CLI not found. Installing..."
  curl -sSL https://railway.app/install.sh | bash
  export PATH="$HOME/.railway/bin:$PATH"
fi

if ! command -v railway >/dev/null 2>&1; then
  echo "Railway CLI still not detected. Path issue."
  exit 1
fi

if railway whoami >/dev/null 2>&1; then
  echo "Railway already authenticated."
elif [ -n "${RAILWAY_TOKEN:-}" ]; then
  echo "Logging in with RAILWAY_TOKEN..."
  railway login --ci "$RAILWAY_TOKEN"
else
  echo "Railway authentication required. Opening login prompt..."
  railway login
fi

PROJECT_NAME="${1:-haloit-backend}"
echo "Using Railway project: $PROJECT_NAME"

railway init --name "$PROJECT_NAME" || true

if [ -f .env ]; then
  echo "Setting Railway variables from .env"
  while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "${line// /}" || "$line" =~ ^# ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    if [[ -n "$key" ]]; then
      echo "Setting: $key"
      railway variables set "$key=$val" || true
    fi
  done < .env
else
  echo ".env file not found in backend directory, skipping variable upload"
fi

echo "Starting Railway deploy..."
railway up --detach

echo "✅ Backend deploy started successfully"
echo "Run: railway logs  (to monitor)"
