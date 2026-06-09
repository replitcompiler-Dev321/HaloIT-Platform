Uploading frontend to Xneelo (FTP)
=================================

Prerequisites
- `lftp` installed on your machine (or use FileZilla/WinSCP).

Quick steps (recommended, runs locally from your machine or KonsoleH):

1. From repo root, export FTP creds (example using your provided username):

```bash
export FTP_HOST=ftp.yourdomain.co.za
export FTP_USER=haloirskxm
export FTP_PASS="<your-password-here>"
# optional: export FTP_REMOTE_DIR=public_html
```

2. Run the upload script:

```bash
cd halo-system
./scripts/upload_xneelo.sh ./frontend
```

Optional automatic deploy using hardcoded credentials:

```bash
cd halo-system
bash ./scripts/deploy_xneelo_auto.sh
```

Notes
- The `upload_xneelo.sh` script mirrors `./frontend` to the remote `public_html` by default and deletes remote files not present locally.
- The `deploy_xneelo_auto.sh` script also uploads `./backend` to a hardcoded remote folder (`halo-backend`) in addition to the frontend.
- If you prefer GUI, use FileZilla: connect with the same host/user/pass and upload the contents of `halo-system/frontend` into `public_html`.
- Do NOT commit credentials into git unless you intend to hardcode them explicitly in a deployment helper script.
- Unset sensitive env vars after use: `unset FTP_PASS`.
