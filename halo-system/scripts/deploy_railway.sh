
#!/usr/bin/env bash
set -euo pipefail

# Ensure Railway is available (hard fix for Codespaces / scripts)
RAILWAY_BIN="$HOME/.railway/bin/railway"

if [ -x "$RAILWAY_BIN" ]; then
  export PATH="$HOME/.railway/bin:$PATH"
else
  echo "railway CLI not found. Installing..."
  curl -sSL https://railway.app/install.sh | bash
  export PATH="$HOME/.railway/bin:$PATH"
fi

# Double-check it now exists
if ! command -v railway >/dev/null 2>&1; then
  echo "Railway CLI still not detected. Path issue."
  exit 1
fi

PROJECT_NAME=${1:-haloit-backend}
echo "Using Railway project: $PROJECT_NAME"

# Init project (ignore if already linked)
railway init --name "$PROJECT_NAME" || true

# Load .env variables
if [ -f .env ]; then
  echo "Setting Railway variables from .env"

  while IFS= read -r line || [ -n "$line" ]; do
    # skip comments and empty lines
    [[ -z "${line// /}" || "$line" =~ ^# ]] && continue

    key="${line%%=*}"
    val="${line#*=}"

    if [[ -n "$key" ]]; then
      echo "Setting: $key"
      railway variables set "$key=$val"
    fi
  done < .env
else
  echo ".env file not found, skipping variable upload"
fi

echo "Starting deploy..."
railway up --detach

echo "✅ Deploy started successfully"
echo "Run: railway logs  (to monitor)"
