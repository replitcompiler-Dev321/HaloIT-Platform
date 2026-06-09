
#!/usr/bin/env bash
set -euo pipefail

# Frontend upload to Xneelo FTP.
# Xneelo is static website hosting only. Backend apps should deploy to Railway or another Node host.
FTP_HOST="${FTP_HOST:-ftp.haloitservices365.co.za}"
FTP_USER="${FTP_USER:-haloirskxm}"
FTP_PASS="${FTP_PASS:-}"
FTP_REMOTE_FRONTEND_DIR="${FTP_REMOTE_FRONTEND_DIR:-public_html}"
FRONTEND_DIR="${FRONTEND_DIR:-/workspaces/Haloitservices365/halo-system/frontend}"

if [ -z "$FTP_PASS" ]; then
  read -sp "Enter FTP password for ${FTP_USER}@${FTP_HOST}: " FTP_PASS
  echo
fi

if ! command -v lftp >/dev/null 2>&1; then
  echo "❌ lftp not installed. Run: sudo apt-get install lftp -y"
  exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "❌ Frontend directory not found: $FRONTEND_DIR"
  exit 1
fi

echo "🚀 Deploying FRONTEND → $FTP_HOST/$FTP_REMOTE_FRONTEND_DIR"
echo "📁 Source: $FRONTEND_DIR"

lftp -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" <<EOF
set ftp:ssl-allow no
mirror -R --delete --verbose --no-symlinks "$FRONTEND_DIR" "$FTP_REMOTE_FRONTEND_DIR"
bye
EOF

echo "✅ Frontend deployed successfully"

echo "🎉 Frontend deployment complete. Use Railway for backend app hosting."
