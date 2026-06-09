# Xneelo / cPanel hosting setup

## Recommended deployment model
Use a dedicated Node.js application on cPanel for the backend, and serve the static frontend from the public_html directory or a separate subdomain.

### Suggested structure
- Backend app: /home/USERNAME/halo-backend
- Frontend files: /home/USERNAME/public_html
- Domain mapping:
  - Main site: https://yourdomain.com
  - API: https://api.yourdomain.com

## Backend deployment checklist
1. Upload the repository or clone it into the backend directory.
2. In the backend directory, install dependencies:
   - cd halo-system/backend
   - npm install --omit=dev
3. Start the app with:
   - npm start
4. Set the app runtime to Node.js 20+.
5. Set environment variables:
   - PORT=3000
   - NODE_ENV=production
   - HOST=0.0.0.0

## Important notes
- The current backend uses SQLite and is suitable for a starter deployment, but a production-grade environment should migrate to MySQL or PostgreSQL.
- The frontend is currently static HTML/CSS/JS, so it can be served directly from public_html.
- The backend should ideally be exposed on a subdomain such as api.yourdomain.com.
- The repo includes `halo-system/scripts/deploy_xneelo_auto.sh` for hardcoded FTP-based frontend and backend sync to Xneelo.

## cPanel setup steps
1. Create a Node.js application in cPanel.
2. Point the app root to the backend directory, usually /home/USERNAME/halo-backend.
3. Set the startup command to:
   - cd halo-system/backend && npm start
4. Make sure the app listens on the provided cPanel port.
5. Add a reverse proxy or subdomain mapping if your hosting plan does not expose the app directly.

## Current repository readiness
The repository already contains a runnable backend entry at:
- halo-system/backend/server.js
- halo-system/backend/package.json

The primary deployment requirement is to run the backend from the backend folder and ensure the app uses the correct port and environment variables.

## Next step after hosting access is available
Once the cPanel account is open, the next implementation step is to upload the repository, install dependencies, then verify the live URLs for:
- /
- /api/auth/login
- /api/dashboard
- /api/tickets
