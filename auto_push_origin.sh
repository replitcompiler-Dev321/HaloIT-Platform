#!/usr/bin/env bash
set -euo pipefail

# Auto push local git changes to the origin remote.
# This script stages all changes, commits with a timestamped message,
# pulls the latest remote branch, and pushes the updates live.

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: this script must be run inside a git repository."
  exit 1
fi

git_root=$(git rev-parse --show-toplevel)
cd "$git_root"

branch=$(git branch --show-current)
if [[ -z "$branch" ]]; then
  echo "Error: could not determine current branch."
  exit 1
fi

remote_branch="$branch"
remotes=( $(git remote) )
if [[ ${#remotes[@]} -eq 0 ]]; then
  echo "Error: no git remotes configured."
  exit 1
fi

echo "Auto updater running on branch '$branch'."

# If an encrypted deploy key exists, decrypt it and use it for Git SSH.
deploy_key_enc="$git_root/deploy_ssh_key.enc"
ssh_key_path="$HOME/.ssh/auto_push_repo_key"

if [[ -f "$deploy_key_enc" ]]; then
  echo "Encrypted deploy key found. Unlocking with passphrase..."
  bash "$git_root/setup_ssh_deploy_key.sh" "$deploy_key_enc" "$ssh_key_path"
  export GIT_SSH_COMMAND="ssh -i '$ssh_key_path' -o IdentitiesOnly=yes -o PreferredAuthentications=publickey -o StrictHostKeyChecking=accept-new"
  echo "GIT_SSH_COMMAND configured to use deploy key."
fi

# Pull latest remote state from origin first to avoid conflicts.
# Use rebase for a cleaner history if possible.
if git remote get-url origin >/dev/null 2>&1; then
  echo "Fetching origin/$remote_branch..."
  git fetch origin "$remote_branch"
fi

status=$(git status --porcelain)
if [[ -n "$status" ]]; then
  echo "Found local changes. Staging all modified and new files..."
  git add -A

  if ! git diff --cached --quiet; then
    commit_message="Auto update: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "Committing local changes with message: $commit_message"
    git commit -m "$commit_message"
  else
    echo "No changes to commit after staging."
  fi
else
  echo "No local changes detected."
fi

# Rebase on top of origin branch if possible.
if git rev-parse --verify --quiet "origin/$remote_branch" >/dev/null 2>&1; then
  echo "Rebasing local branch onto origin/$remote_branch..."
  git pull --rebase origin "$remote_branch"
else
  echo "Origin branch origin/$remote_branch not found. Skipping rebase."
fi

echo "Pushing changes to all configured remotes..."
for remote in "${remotes[@]}"; do
  if git remote get-url "$remote" >/dev/null 2>&1; then
    echo "Pushing to $remote/$remote_branch..."
    git push "$remote" "$remote_branch" || echo "Warning: push failed for remote $remote"
  fi
done

echo "Auto update complete."
