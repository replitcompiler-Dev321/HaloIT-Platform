Railway deployment instructions (backend)
======================================

Prerequisites
- Install the Railway CLI: `curl -sSL https://railway.app/install.sh | sh` (or follow https://railway.app/docs/cli)
- Be logged in: `railway login`
- Have the `halo-system/Dockerfile` (present) or a working `package.json`.

Quick deploy (recommended)
1. From the `halo-system` folder, create a `.env` file with production secrets (DO NOT COMMIT).
2. Initialize or link a Railway project:

```bash
cd halo-system
# create a new project (or omit to link an existing one via the web UI)
railway init --name haloit-backend
```

3. Upload secrets from `.env` (example helper provided in `scripts/deploy_railway.sh`):

```bash
./scripts/deploy_railway.sh
```

4. Deploy (the script runs `railway up`):

```bash
railway up --detach
```

Notes
- The Railway web UI also supports connecting GitHub and automatic deploys from `main`.
- Keep secrets in Railway variables; do not commit `.env` files to git.
- After deploy, view logs: `railway logs` and status with `railway status`.

Security
- Use short-lived or rotated API keys for AI providers; store them as Railway variables.

GitHub Actions automatic deploy
--------------------------------
This repository includes a GitHub Actions workflow at `.github/workflows/deploy-railway.yml` which will automatically deploy the backend to Railway when you push to the `main` branch.

Required GitHub repository secrets (add these under Settings → Secrets → Actions):
- `RAILWAY_TOKEN` — a Railway API token (from the Railway web UI).
- `RAILWAY_PROJECT_NAME` — a unique project name to create/link on Railway (e.g. `haloit-backend`).
- `AZURE_OPENAI_ENDPOINT` — your Azure OpenAI endpoint URL.
- `AZURE_OPENAI_API_KEY` — your Azure OpenAI API key.

Optional GitHub secrets:
- `SUPER_ADMIN_OWNER_EMAIL` — (optional) owner email to auto-promote on first register.
- `JWT_SECRET` — JWT signing secret. **Automatically generated if not provided** (recommended for security to supply your own).

Note: The deployment name (`DeepSeek-V4-Pro`) is hardcoded in the workflow. To change it, edit the workflow file.

After adding secrets, push to `main` and the workflow will build and run `railway up` for you. Watch logs in Actions or use `railway logs` in your Railway project.

