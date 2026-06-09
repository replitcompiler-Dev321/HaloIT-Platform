#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "Building and starting containers with docker-compose..."
docker-compose up -d --build

echo "Deployment complete. Visit http://localhost:3000/admin-portal.html"
