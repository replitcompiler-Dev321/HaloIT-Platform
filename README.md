# Halo IT Services 365

## Current live status (2026-06-09)
This repository now contains a working backend foundation for the Halo platform, plus a set of frontend shells and planning documents. The backend is currently running locally and serving authenticated API routes.

### Verified working today
- Backend health endpoint: GET /
- Authentication: register/login/logout/me and JWT refresh flow
- RBAC and permission checks for users, tickets, clients and monitoring
- MFA support is present in the codebase and the backend routes are wired for MFA verification
- Dashboard metrics endpoint is now working after a schema fix for SLA fields
- Ticket, client, monitoring, SLA and audit-log APIs are responding

### Live access
- Public tunnel: https://haloitservices365.loca.lt
- Main backend root: https://haloitservices365.loca.lt/

### Auto updater script
Use `./auto_push_origin.sh` from the repository root to commit local changes and push them live to `origin`.

```bash
cd /workspaces/Haloitservices365
bash ./auto_push_origin.sh
```

This script stages all file changes, commits them with a timestamped message, pulls remote updates, and pushes to the current branch on `origin`.

### One-step commit + Xneelo deploy
Use `deploy_commit_push_xneelo.sh` to commit and push repo changes, then deploy the frontend to Xneelo.

```bash
cd /workspaces/Haloitservices365
bash ./deploy_commit_push_xneelo.sh
```

### Secure SSH deploy key (optional)
If you want SSH-based auto push from new clones, add an encrypted deploy key file named `deploy_ssh_key.enc` to the repo root.

1. Store the private SSH key locally outside git.
2. Encrypt it with `encrypt_ssh_key.sh`:

```bash
cd /workspaces/Haloitservices365
bash ./encrypt_ssh_key.sh ~/.ssh/id_ed25519_auto_push ./deploy_ssh_key.enc
```

3. Add the passphrase to your local environment or to GitHub Actions as `DEPLOY_KEY_PASSPHRASE`.
4. The auto updater will decrypt it on first run and use it for `git push` and `git pull`.

This adds a second authentication layer because the encrypted key file alone is not enough; the passphrase is also required.

### Project tracking docs
- Current audit: docs/CURRENT_SYSTEM_AUDIT.md
- Gap analysis: docs/GAP_ANALYSIS.md
- Feature tracker: docs/feature-tracker.md
- Development roadmap: docs/development-roadmap.md
- Xneelo / cPanel hosting plan: docs/xneelo-cpanel-hosting.md

## What is already implemented
- Core Node.js/Express backend with SQLite via Sequelize
- Auth, user management and role-based permissions
- Ticketing foundation with categories, priority, assignee, approvals and time tracking
- Client records and client-user membership support
- Dashboard and SLA metrics endpoints
- Monitoring device health and heartbeat endpoints
- Audit logging and failure logging
- Static frontend shells for login, dashboard, client portal and admin AI settings

## What still needs to be completed
The biggest remaining work is now the business-layer product buildout:
- Knowledge base and client KB workflows
- Invoicing, quoting and accounting
- RMM, backup agents and monitoring automation
- Learning centre and exam sponsorship workflows
- Integrations centre
- Security operations centre, vault and policy controls
- App builder / DevConsole / rollout controls
- Full AI provider integration beyond current settings stub

## Delivery note
The system is no longer a prototype-only scaffold. It is a real backend platform with core modules already wired, but the full Halo product suite still needs a second wave of implementation and UI integration.
