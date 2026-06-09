#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

branch="$(git branch --show-current || true)"
if [[ -z "$branch" ]]; then
  echo "Error: could not determine current git branch."
  exit 1
fi

echo "🔄 Auto update deploy starting on branch '$branch'"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "📦 Staging local changes..."
  git add -A
  if ! git diff --cached --quiet; then
    commit_message="Auto update: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "📝 Committing: $commit_message"
    git commit -m "$commit_message"
  else
    echo "✔ No staged changes to commit."
  fi
else
  echo "✔ No local changes detected."
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "⬇️ Fetching latest origin/$branch..."
  git fetch origin "$branch" || true
  if git rev-parse --verify --quiet "origin/$branch" >/dev/null 2>&1; then
    echo "🔀 Rebase onto origin/$branch..."
    git pull --rebase origin "$branch" || true
  fi
  echo "⬆️ Pushing branch $branch to origin..."
  git push origin "$branch"
else
  echo "⚠️ No origin remote configured. Skipping push."
fi

if [[ "${SKIP_XNEELO_DEPLOY:-0}" != "1" ]]; then
  echo "🚀 Deploying frontend to Xneelo..."
  bash halo-system/scripts/deploy_xneelo_auto.sh
else
  echo "ℹ️ Skipping Xneelo frontend deploy (SKIP_XNEELO_DEPLOY=1)."
fi

if [[ "${SKIP_RAILWAY_DEPLOY:-0}" != "1" ]]; then
  echo "🚀 Deploying backend to Railway..."
  bash halo-system/scripts/deploy_railway.sh "${RAILWAY_PROJECT_NAME:-haloit-backend}"
else
  echo "ℹ️ Skipping Railway backend deploy (SKIP_RAILWAY_DEPLOY=1)."
fi

echo "✅ Auto update deploy complete."
