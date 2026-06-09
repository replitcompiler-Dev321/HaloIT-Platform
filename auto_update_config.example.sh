# Auto update config defaults.
# Copy this file to auto_update_config.sh and edit as needed for your environment.

# Encrypted SSH deploy key relative to repo root.
SSH_DEPLOY_KEY_ENC="deploy_ssh_key.enc"

# Unlocked private key path written by setup_ssh_deploy_key.sh.
SSH_DEPLOY_KEY_PATH="$HOME/.ssh/auto_push_repo_key"

# Backend deployment script path relative to repo root.
BACKEND_DEPLOY_SCRIPT="halo-system/scripts/deploy_railway.sh"

# Frontend deployment script path relative to repo root.
FRONTEND_DEPLOY_SCRIPT="halo-system/scripts/deploy_xneelo_auto.sh"

# Optional alternate providers can be set here:
# FRONTEND_PROVIDER="xneelo"
# BACKEND_PROVIDER="railway"

# Add extra provider-specific fallback scripts if needed.
# Examples:
# FRONTEND_DEPLOY_SCRIPT="halo-system/scripts/deploy_other_frontend.sh"
# BACKEND_DEPLOY_SCRIPT="halo-system/scripts/deploy_other_backend.sh"
