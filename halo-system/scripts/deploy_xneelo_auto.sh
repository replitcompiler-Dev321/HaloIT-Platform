#!/usr/bin/env bash
set -euo pipefail

# Xneelo FTP credentials.
# The script prompts for password interactively for safer use.
FTP_HOST="ftp.haloitservices365.co.za"
FTP_USER="haloirskxm"

read -sp "Enter FTP password for ${FTP_USER}@${FTP_HOST}: " FTP_PASS
echo

# Remote target directories on the Xneelo account.
FTP_REMOTE_FRONTEND_DIR="public_html"
FTP_REMOTE_BACKEND_DIR="halo-backend"

LOCAL_FRONTEND_DIR="./frontend"
LOCAL_BACKEND_DIR="./backend"

echo "Deploying frontend to ${FTP_HOST}/${FTP_REMOTE_FRONTEND_DIR}"

echo "lftp -c \"set ftp:ssl-allow no; open -u ${FTP_USER},${FTP_PASS} ${FTP_HOST}; mirror -R --delete --verbose ${LOCAL_FRONTEND_DIR} ${FTP_REMOTE_FRONTEND_DIR}; bye\""

lftp -c "set ftp:ssl-allow no; open -u ${FTP_USER},${FTP_PASS} ${FTP_HOST}; mirror -R --delete --verbose ${LOCAL_FRONTEND_DIR} ${FTP_REMOTE_FRONTEND_DIR}; bye"

echo "Frontend deploy complete."

echo "Deploying backend to ${FTP_HOST}/${FTP_REMOTE_BACKEND_DIR}"

lftp -c "set ftp:ssl-allow no; open -u ${FTP_USER},${FTP_PASS} ${FTP_HOST}; mirror -R --delete --verbose ${LOCAL_BACKEND_DIR} ${FTP_REMOTE_BACKEND_DIR}; bye"

echo "Backend deploy complete."
