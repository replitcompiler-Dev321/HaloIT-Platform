#!/usr/bin/env bash
set -euo pipefail

# Combined helper: commit local git changes, push to origin, then deploy frontend to Xneelo.
# Usage: bash ./deploy_commit_push_xneelo.sh

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

if [[ ! -f "./auto_push_origin.sh" ]]; then
  echo "Error: auto_push_origin.sh not found in repo root."
  exit 1
fi

if [[ ! -f "./halo-system/scripts/deploy_xneelo_auto.sh" ]]; then
  echo "Error: halo-system/scripts/deploy_xneelo_auto.sh not found."
  exit 1
fi

bash ./auto_push_origin.sh

echo
cd ./halo-system
bash ./scripts/deploy_xneelo_auto.sh

echo "Repository commit/push and Xneelo frontend deploy complete."
