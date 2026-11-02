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
| `MESSAGING_DRY_RUN` | no | `false` to really send WhatsApp and email. Default `true`: messages are only printed in the server log (the old name `WEBHOOK_DRY_RUN` still works) |
| `GREEN_API_URL` | for WhatsApp | The instance's API URL from the Green API console, e.g. `https://7105.api.greenapi.com` (default `https://api.green-api.com`) |
| `GREEN_API_INSTANCE_ID` | for WhatsApp | Green API `idInstance`, e.g. `7105123456` |
| `GREEN_API_TOKEN` | for WhatsApp | Green API `apiTokenInstance` |
| `SMTP_HOST` | for email | `smtp.gmail.com` (Google Workspace) or `smtp.office365.com` (Microsoft 365) |
| `SMTP_PORT` | for email | `465` (Google Workspace) or `587` (Microsoft 365) |
| `SMTP_SECURE` | for email | `true` for port 465, `false` for port 587 (STARTTLS) |
| `SMTP_USER` | for email | The company mailbox, e.g. `office@yaroknet.co.il` |
| `SMTP_PASS` | for email | Google: an App Password; Microsoft 365: the mailbox password |
| `SMTP_FROM` | for email | Sender shown to recipients, e.g. `ירוק <office@yaroknet.co.il>` (default: `SMTP_USER`) |
| `CONTACT_FORM_TO` | no | Where website contact-form inquiries are emailed (default `maya@yaroknet.co.il`) |
| `GEMINI_API_KEY` | no | Google AI Studio key (free tier). Powers the AI chat assistant and reads driving licenses, vehicle licenses and insurance in the fleet documents; without it the assistant is off and those details are entered by hand |
| `ENABLE_CRON` | no | `true` to run scheduled reminders and summaries (needs a paid Render plan; free services sleep) |

## WhatsApp and email

The backend sends WhatsApp messages through [Green API](https://green-api.com) with the company's WhatsApp
number, and emails through the company mailbox (SMTP). There are no automation services (Make.com / n8n) in
between. Until `MESSAGING_DRY_RUN=false` is set, nothing is sent: each message is printed in the server log and
treated as sent, so local testing never reaches real people. Sent WhatsApp messages are recorded in
`whatsapp_log` (employees area) and `fleet_n8n_events` (fleet), with the send result.

### Setting up Green API (WhatsApp)

1. Sign up at [console.green-api.com](https://console.green-api.com) and create an instance (a paid plan is
   needed for messaging customers; the free Developer plan is enough for a first test).
2. Open the instance, choose to link a phone, and scan the QR code from the company WhatsApp
   (WhatsApp → Settings → Linked devices → Link a device). The instance status becomes "authorized".
3. Copy **idInstance** to `GREEN_API_INSTANCE_ID`, **apiTokenInstance** to `GREEN_API_TOKEN`, and **apiUrl**
   (e.g. `https://7105.api.greenapi.com`) to `GREEN_API_URL`.

Phone numbers in the system can be written as `050-1234567`, `+972 50 1234567` and so on; they are converted to
Green API's `972501234567@c.us` form automatically.

### Setting up SMTP (email)

- **Google Workspace**: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`. Turn on 2-Step
  Verification for the mailbox, then create an App Password at
  [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) and use it as `SMTP_PASS`.
- **Microsoft 365**: `SMTP_HOST=smtp.office365.com`, `SMTP_PORT=587`, `SMTP_SECURE=false` (STARTTLS). In the
  Microsoft 365 admin center → Users → the mailbox → Mail → Manage email apps, enable **Authenticated SMTP**
  (SMTP AUTH). Use the mailbox password as `SMTP_PASS` (accounts with MFA may need an app password).

`SMTP_USER` is the full mailbox address and `SMTP_FROM` must be that mailbox (or an alias it may send as).
