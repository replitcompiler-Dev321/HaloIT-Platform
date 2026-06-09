#!/usr/bin/env bash
set -euo pipefail

# Upload local frontend to Xneelo via FTP using lftp mirror.
# This script reads credentials from env vars for safety.
# Requirements: install `lftp` (e.g., `sudo apt install lftp`).

: "${FTP_HOST:?Need FTP_HOST (e.g. ftp.yourdomain.co.za)}"
: "${FTP_USER:?Need FTP_USER}"
FTP_PASS="${FTP_PASS:-}"

if [ -z "$FTP_PASS" ]; then
  read -sp "Enter FTP password for ${FTP_USER}@${FTP_HOST}: " FTP_PASS
  echo
fi

LOCAL_DIR="${1:-./frontend}"
REMOTE_DIR="${FTP_REMOTE_DIR:-public_html}"

echo "Uploading $LOCAL_DIR -> $FTP_HOST/$REMOTE_DIR (user: $FTP_USER)"

lftp -c "set ftp:ssl-allow no; open -u ${FTP_USER},${FTP_PASS} ${FTP_HOST}; mirror -R --delete --verbose --no-symlinks ${LOCAL_DIR} ${REMOTE_DIR}"

echo "Upload complete."
