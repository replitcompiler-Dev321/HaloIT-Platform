#!/usr/bin/env bash
set -euo pipefail

# Decrypt an encrypted deploy SSH key and write it to ~/.ssh/auto_push_repo_key.
# Usage: ./setup_ssh_deploy_key.sh [encrypted-key-file] [output-key-path]

encrypted_key_file="${1:-$(pwd)/deploy_ssh_key.enc}"
ssh_key_path="${2:-$HOME/.ssh/auto_push_repo_key}"
passphrase="${DEPLOY_KEY_PASSPHRASE:-}"

if [[ ! -f "$encrypted_key_file" ]]; then
  echo "Error: Encrypted deploy key not found: $encrypted_key_file"
  exit 1
fi

if [[ -z "$passphrase" ]]; then
  read -srp "Enter passphrase to unlock deploy key: " passphrase
  echo
fi

mkdir -p "$(dirname "$ssh_key_path")"
openssl aes-256-cbc -d -in "$encrypted_key_file" -out "$ssh_key_path" -pass pass:"$passphrase"
chmod 600 "$ssh_key_path"
echo "$ssh_key_path"
