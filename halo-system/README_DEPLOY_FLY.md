Fly.io deployment instructions (backend)
=====================================

Prerequisites
- Install `flyctl`: https://fly.io/docs/hands-on/install-flyctl/
- Have a Fly account and be logged in: `flyctl auth login`
- Ensure Dockerfile exists at the repository root (it does: `Dockerfile`)

Quick deploy
1. From the `halo-system` folder, create a `.env` file with production secrets (DO NOT COMMIT).
2. Run the helper script (optionally set `APP_NAME`):

```bash
cd halo-system
APP_NAME=my-unique-app-name ./scripts/deploy_fly.sh
```

Notes
- The script will attempt to create the Fly app and copy all `KEY=VALUE` entries from `.env` into Fly secrets.
- If you prefer, run `flyctl secrets set KEY=VALUE` manually for each secret instead of using `.env`.
- After deploy, view logs with `flyctl logs --app my-unique-app-name` and status with `flyctl status --app my-unique-app-name`.

Security
- Keep secrets out of git. Use Fly secrets for runtime values like `AZURE_OPENAI_API_KEY`, `JWT_SECRET`, etc.
