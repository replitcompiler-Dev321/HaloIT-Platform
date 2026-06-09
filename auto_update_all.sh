#!/usr/bin/env bash
set -euo pipefail

# Auto update orchestrator.
# Commits/pushes repo changes to all remotes, then deploys backend and frontend.

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

# Load configuration if present, otherwise fall back to the example defaults.
if [[ -f "$repo_root/auto_update_config.sh" ]]; then
  source "$repo_root/auto_update_config.sh"
elif [[ -f "$repo_root/auto_update_config.example.sh" ]]; then
  source "$repo_root/auto_update_config.example.sh"
else
  echo "Error: no auto update config found."
  exit 1
fi

# Use encrypted SSH key for Git if configured.
if [[ -n "${SSH_DEPLOY_KEY_ENC:-}" && -f "$repo_root/$SSH_DEPLOY_KEY_ENC" ]]; then
  echo "Encrypted SSH deploy key found at $SSH_DEPLOY_KEY_ENC. Unlocking..."
  bash "$repo_root/setup_ssh_deploy_key.sh" "$repo_root/$SSH_DEPLOY_KEY_ENC" "${SSH_DEPLOY_KEY_PATH:-$HOME/.ssh/auto_push_repo_key}"
  export GIT_SSH_COMMAND="ssh -i '${SSH_DEPLOY_KEY_PATH:-$HOME/.ssh/auto_push_repo_key}' -o IdentitiesOnly=yes -o PreferredAuthentications=publickey -o StrictHostKeyChecking=accept-new"
  echo "GIT_SSH_COMMAND configured for deploy key."
else
  echo "No encrypted SSH deploy key configured or found. Using default Git SSH/authentication environment."
fi

# Push repository changes to all configured remotes.
if [[ ! -f "$repo_root/auto_push_origin.sh" ]]; then
  echo "Error: auto_push_origin.sh not found in the repo root."
  exit 1
fi

bash "$repo_root/auto_push_origin.sh"

# Deploy backend
if [[ -n "${BACKEND_DEPLOY_SCRIPT:-}" ]]; then
  backend_script="$repo_root/$BACKEND_DEPLOY_SCRIPT"
  if [[ -x "$backend_script" || -f "$backend_script" ]]; then
    echo "Running backend deploy script: $BACKEND_DEPLOY_SCRIPT"
    bash "$backend_script"
  else
    echo "Backend deploy script not found: $BACKEND_DEPLOY_SCRIPT"
  fi
else
  echo "No backend deploy script configured. Skipping backend deploy."
fi

# Deploy frontend
if [[ -n "${FRONTEND_DEPLOY_SCRIPT:-}" ]]; then
  frontend_script="$repo_root/$FRONTEND_DEPLOY_SCRIPT"
  if [[ -x "$frontend_script" || -f "$frontend_script" ]]; then
    echo "Running frontend deploy script: $FRONTEND_DEPLOY_SCRIPT"
    bash "$frontend_script"
  else
    echo "Frontend deploy script not found: $FRONTEND_DEPLOY_SCRIPT"
  fi
else
  echo "No frontend deploy script configured. Skipping frontend deploy."
fi

echo "Auto update all complete."
