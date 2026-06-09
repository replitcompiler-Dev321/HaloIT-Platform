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

Notes
- The script mirrors `./frontend` to the remote `public_html` by default and deletes remote files not present locally.
- If you prefer GUI, use FileZilla: connect with the same host/user/pass and upload the contents of `halo-system/frontend` into `public_html`.
- Do NOT commit credentials into git. Unset sensitive env vars after use: `unset FTP_PASS`.
