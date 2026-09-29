# Yarok platform

The Yarok website with its employees area (Yarok 360) and the backend, on MongoDB.

```
site/     Frontend (React + Vite): public website, client portal, platform modules,
          and the employees area (Yarok 360) under src/employees -> /employees
  supabase/functions/           Server functions of the platform
  supabase/functions-yarok360/  Server functions of the employees area
server/   Backend (Node + Express + MongoDB): database API, login, file storage,
          realtime, server functions, scheduled jobs; also serves the built website
```

The frontend talks to the backend with the `@supabase/supabase-js` client library; the backend implements
that API on top of MongoDB under `/api/site` (platform) and `/api/ops` (employees area). One database, one login.

## Run locally

Requires Node 22+ and MongoDB on `mongodb://127.0.0.1:27017`.

```bash
npm run install:all
npm run setup        # creates .env.local
npm run create-user -- --project site --email you@example.com --password <password> --name "Your Name" --role super_admin
npm run dev          # website on http://localhost:8090 (backend on :3001)
```

Employees log in at `/employees/` (menu: אזור אישי → עובדים).

## Deploy to Render

`render.yaml` defines one web service that builds the website and runs the backend.

1. Create a MongoDB Atlas cluster and copy its connection string (Network Access: allow `0.0.0.0/0`).
2. In Render: **New → Blueprint**, pick this repository, and paste the connection string as `MONGODB_URI`.
3. After the first deploy, create the first admin from the service's **Shell** tab:
   `npm run create-user -- --project site --email ... --password ... --name "..." --role super_admin`

## Settings (`.env.local` locally, Environment in Render)

| Setting | Needed | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Signs logins (`npm run setup` / Render generates it) |
| `MONGODB_DB` | no | Database name, default `yarok` |
| `WEBHOOK_DRY_RUN` | no | `false` to really send WhatsApp / n8n / email (default: only logged) |
| `ENABLE_CRON` | no | `true` to run scheduled reminders and summaries (needs a paid Render plan; free services sleep) |
