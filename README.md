# Yarok platform

The Yarok website with its employees area (Yarok 360) and the backend, on MongoDB.

```
site/     Frontend (React + Vite): public website, client portal, platform modules,
          and the employees area (Yarok 360) under src/employees -> /employees
  supabase/functions/           Edge functions of the platform
  supabase/functions-yarok360/  Edge functions of the employees area
server/   Backend (Node + Express + MongoDB): database API, login, file storage,
          realtime, edge-function runtime, scheduled jobs
```

The frontend talks to the backend with `@supabase/supabase-js`; the backend implements the same
HTTP API on top of MongoDB (`/api/site/...` for the platform, `/api/ops/...` for the employees area).
Both share one database and one login.

## Run locally

Requires Node 22+ and MongoDB running on `mongodb://127.0.0.1:27017`.

```bash
npm run install:all
npm run setup        # creates .env.local (backend secrets) and site/.env
npm run create-user -- --project site --email you@example.com --password <password> --name "Your Name" --role super_admin
npm run dev          # backend on :3001, website on http://localhost:8090
```

Employees log in at `/employees/` (menu: אזור אישי → עובדים).

## Deploy to Render

The repo contains a Blueprint (`render.yaml`) with two services:

| Service | Type | What it runs |
|---|---|---|
| `yarok-api` | Web Service (Node) | `server/` — `npm install`, `npm start` |
| `yarok-site` | Static Site | `site/` — `npm install && npm run build`, publishes `site/dist` |

1. Create a MongoDB Atlas cluster and copy its connection string (allow access from anywhere,
   or from Render's outbound IPs).
2. Run `npm run keys:production` locally to generate `JWT_SECRET`, `ANON_KEY` and `SERVICE_ROLE_KEY`.
3. In Render: **New → Blueprint**, pick this repository, and fill in the values:
   - `yarok-api`: `MONGODB_URI`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`,
     `SITE_URL` = the `yarok-site` URL.
   - `yarok-site`: `VITE_SUPABASE_URL` = `<yarok-api URL>/api/site`,
     `VITE_EMPLOYEES_API_URL` = `<yarok-api URL>/api/ops`,
     `VITE_SUPABASE_PUBLISHABLE_KEY` = the same `ANON_KEY`.
4. After the first deploy, redeploy `yarok-site` if you changed any `VITE_*` value (they are baked in at build time).
5. Create the first admin: in the `yarok-api` Shell, run
   `npm run create-user -- --project site --email ... --password ... --name "..." --role super_admin`.

WhatsApp / n8n / email webhooks stay in dry-run mode until `WEBHOOK_DRY_RUN=false`; scheduled jobs run
only with `ENABLE_CRON=true` (on Render's free plan the service sleeps when idle, so use a paid plan for jobs).
