#!/usr/bin/env bash
set -euo pipefail

# Encrypt a private SSH key for secure distribution in the repo.
# Usage: ./encrypt_ssh_key.sh /path/to/private_key [output-encrypted-file]

private_key_path="${1:-}"
output_file="${2:-./deploy_ssh_key.enc}"

if [[ -z "$private_key_path" ]]; then
  echo "Usage: $0 /path/to/private_key [output-encrypted-file]"
  exit 1
fi

if [[ ! -f "$private_key_path" ]]; then
  echo "Error: private key not found: $private_key_path"
  exit 1
fi

read -srp "Enter passphrase to encrypt this key: " passphrase
echo
read -srp "Confirm passphrase: " confirm
echo

if [[ "$passphrase" != "$confirm" ]]; then
  echo "Error: passphrases do not match."
  exit 1
fi

openssl aes-256-cbc -salt -in "$private_key_path" -out "$output_file" -pass pass:"$passphrase"
echo "Encrypted SSH key written to $output_file"
