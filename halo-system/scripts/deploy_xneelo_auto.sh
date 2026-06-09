
#!/usr/bin/env bash
set -euo pipefail

# ✅ FTP config
FTP_HOST="ftp.haloitservices365.co.za"
FTP_USER="haloirskxm"

# ✅ Prompt securely for password
read -sp "Enter FTP password for ${FTP_USER}@${FTP_HOST}: " FTP_PASS
echo

# ✅ Remote directories (Xneelo)
FTP_REMOTE_FRONTEND_DIR="public_html"
FTP_REMOTE_BACKEND_DIR="halo-backend"

# ✅ CORRECT LOCAL PATHS (fixed to your repo)
FRONTEND_DIR="/workspaces/Haloitservices365/halo-system/frontend"
BACKEND_DIR="/workspaces/Haloitservices365/halo-system/backend"

# ✅ Check required tool
if ! command -v lftp >/dev/null 2>&1; then
  echo "❌ lftp not installed. Run: sudo apt-get install lftp -y"
  exit 1
fi

# ✅ Verify frontend exists
if [ ! -d "$FRONTEND_DIR" ]; then
  echo "❌ Frontend directory not found: $FRONTEND_DIR"
  exit 1
fi

echo "🚀 Deploying FRONTEND → $FTP_HOST/$FTP_REMOTE_FRONTEND_DIR"
echo "📁 Source: $FRONTEND_DIR"

lftp -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" <<EOF
set ftp:ssl-allow no
mirror -R --delete --verbose "$FRONTEND_DIR" "$FTP_REMOTE_FRONTEND_DIR"
bye
EOF

echo "✅ Frontend deployed successfully"

# ✅ Deploy backend (only if it exists)
if [ -d "$BACKEND_DIR" ]; then
  echo "🚀 Deploying BACKEND → $FTP_HOST/$FTP_REMOTE_BACKEND_DIR"
  echo "📁 Source: $BACKEND_DIR"

  lftp -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" <<EOF
set ftp:ssl-allow no
mirror -R --delete --verbose "$BACKEND_DIR" "$FTP_REMOTE_BACKEND_DIR"
bye
EOF

  echo "✅ Backend deployed successfully"
else
  echo "⚠️ Backend directory not found, skipping backend deploy"
fi

echo "🎉 FULL DEPLOY COMPLETE"
