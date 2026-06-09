# Deployment Guide - Halo IT Services 365

This document explains automated deployment options for the Halo system.

Local Docker (recommended for quick public hosting)

1. Ensure Docker and Docker Compose are installed.
2. From the workspace root run:

```bash
chmod +x ./deploy_local.sh
./deploy_local.sh
```

3. The app will be available at: http://localhost:3000/admin-portal.html

Deploy via the Admin Setup page

- Open `/admin/setup.html` after logging in as `super_admin` and use the provided buttons to install dependencies, initialize the database, run the server, or deploy with Docker Compose.

Deploy to Replit / Render / Other

- You can connect this repository to a service like Replit or Render. Use the `Dockerfile` and `docker-compose.yml` provided to build the container.

Notes and next steps

- The admin UI exposes a terminal endpoint that can execute server-side commands for automated workflows. Use with caution and ensure the server runs on a trusted network during deployment.
- For public HTTPS hosting, use a managed provider (Render, Fly.io, Railway) or place an NGINX reverse proxy with a TLS certificate (Let's Encrypt).
