# Railway Setup Checklist

## Step 1: Get Railway Token
1. Go to [Railway.app](https://railway.app)
2. Sign up / log in
3. Go to Settings → API Keys → Create API Token
4. Copy the token

## Step 2: Add GitHub Secrets
Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret

Add these **required** secrets:

| Secret Name | Value | Example |
|---|---|---|
| `RAILWAY_TOKEN` | Your Railway API token from Step 1 | `rly_...` |
| `RAILWAY_PROJECT_NAME` | Unique project name | `haloit-backend` |
| `AZURE_OPENAI_ENDPOINT` | Your Azure OpenAI endpoint | `https://willemhattingh-8180-resource.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY` | Your Azure OpenAI API key | `xxxxxxxxxxxxx...` |

### Optional secrets:

| Secret Name | Value | Example |
|---|---|---|
| `SUPER_ADMIN_OWNER_EMAIL` | Owner email | `willem.hattingh@haloitservices365.co.za` |
| `JWT_SECRET` | Custom JWT secret (auto-generated if not provided) | `your-secret-here` |

**Note:** The Azure deployment name (`DeepSeek-V4-Pro`) is already configured in the workflow.

## Step 3: Push to main
Once secrets are added, push any commit to `main`:
```bash
git add .
git commit -m "Add Railway deployment workflow"
git push
```

## Step 4: Monitor Deploy
1. Go to GitHub repo → Actions
2. Watch the `Deploy Backend to Railway` workflow run
3. Once complete, go to Railway web UI to verify your app is running

## Troubleshooting
- Check GitHub Actions logs: Actions tab → latest run
- Check Railway logs: `railway logs` (if you have Railway CLI)
- Ensure `RAILWAY_TOKEN` is correct and has deployment permissions
