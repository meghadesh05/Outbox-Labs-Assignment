# 📬 ReachInbox Email Scheduler — Full-Stack Outbox Engine

An autonomous, full-stack email scheduling and dispatching application built for the **ReachInbox Internship Assignment**.

This platform allows recruiters and sales teams to upload CSV or text recipient files, configure email subjects and templates, choose from multiple SMTP senders, schedule email dispatching with staggered delays, enforce Redis-backed atomic hourly rate limits per sender, view live Ethereal inbox previews, receive Slack breach alerts, and monitor BullMQ queues in real time.

---

## 🏗️ Architecture Overview

```
                                  +---------------------------+
                                  | React + Vite + TypeScript |
                                  |    Tailwind CSS (UI)      |
                                  +-------------+-------------+
                                                |
                                      HTTP / Cookies (REST)
                                                |
                                                v
                                  +---------------------------+
                                  |   Express Backend API     |
                                  |       (TypeScript)        |
                                  +------+-------+------+-----+
                                         |       |      |
             +---------------------------+       |      +--------------------------+
             |                                   |                                 |
             v                                   v                                 v
+------------------------+          +-------------------------+          +--------------------+
|    PostgreSQL (pg)     |          |      Redis (BullMQ)     |          |   Elasticsearch    |
| Users, Senders, Emails |          | Delayed Queue & Limits  |          | Full-Text Search   |
+------------------------+          +------------+------------+          +--------------------+
                                                 |
                                                 | (Jobs Consumed)
                                                 v
                                    +-------------------------+
                                    |     BullMQ Worker       |
                                    |  (Standalone Process)   |
                                    +------------+------------+
                                                 |
                         +-----------------------+-----------------------+
                         |                                               |
                         v                                               v
            +-------------------------+                     +-------------------------+
            | Nodemailer + Ethereal   |                     |     Slack Webhook       |
            | Real SMTP Email Preview |                     | Rate Limit Alerts API   |
            +-------------------------+                     +-------------------------+
```

### Key Technical Pillars:
1. **Express API Server (`src/index.ts`)**: Handles Google OAuth 2.0, user sessions, CSV recipient parsing, email batch scheduling, Slack configuration, and mounts Bull Board.
2. **BullMQ Delayed Worker (`src/worker.ts`)**: An independent worker process with configurable concurrency (`WORKER_CONCURRENCY=5`) that consumes delayed jobs from Redis, checks per-sender rate limits, and sends emails.
3. **Redis Atomic Rate Limiter (`src/services/rateLimiter.ts`)**: Atomic Lua script that counts per-sender emails within a 1-hour window. If a sender exceeds their hourly limit, the email is automatically rescheduled to the next hour window, and a Slack alert is delivered.
4. **Startup Reconciliation (`src/queue/reconciliation.ts`)**: Automatically checks PostgreSQL on boot for un-dispatched or delayed emails and restores missing jobs into BullMQ.
5. **Database Idempotency Safeguards**: Enforced via `idempotency_key` unique constraints and database checks to prevent duplicate dispatches.
6. **Ethereal SMTP Integration**: Auto-provisions real Ethereal SMTP test accounts on boot; generates real, viewable web inbox URLs for every sent email.
7. **Elasticsearch Full-Text Indexing (`src/services/elasticsearch.ts`)**: Indexes email documents and performs multi-field fuzzy search, with automatic fallback to PostgreSQL `ILIKE`.

---

## 🚀 Quick Start (Under 2 Minutes)

### 1. Prerequisites
- **Node.js** (v18 or higher recommended; tested on v24)
- **Redis** running on port `6379` (Included portable Windows Redis binary or standard system service)
- **PostgreSQL** on port `5432` (Optional: application automatically starts in-memory PostgreSQL emulator if local PostgreSQL is not running)

### 2. Install Dependencies
Run the install command from the project root:
```bash
# In backend directory
npm install --prefix backend

# In frontend directory
npm install --prefix frontend
```

### 3. Run Automated Test Suite
Verify all 12 system requirements and integrations with one command:
```bash
npm test --prefix backend
```
**Test Results Output:**
```
======================================================
📊 TEST RESULTS SUMMARY
======================================================
✅ Database Connection & Migrations
✅ Redis Connection
✅ Elasticsearch Connection & Indexing Mapping
✅ Ethereal SMTP Sender Setup
✅ CSV/TXT Recipient Parser & Deduplication
✅ Database Duplicate Prevention & Idempotency Safeguards
✅ Redis-Backed Atomic Hourly Rate Limiter & Slack Alert Trigger
✅ Slack Notification Integration
✅ Nodemailer + Ethereal SMTP Email Sending
✅ BullMQ Delayed Job Scheduling & Worker Execution
✅ Startup Reconciliation & Restart Persistence
✅ Email Search (Elasticsearch with DB Fallback)

Score: 12/12 tests passed.
======================================================
```

### 4. Start the Application
Start the unified API server and BullMQ worker:
```bash
npm run dev --prefix backend
```
In a second terminal, start the Vite frontend:
```bash
npm run dev --prefix frontend
```

Open your browser at **http://localhost:5173**.

---

## ⚙️ Environment Configuration (`.env`)

A comprehensive `.env.example` file is included in the project root:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Backend API port |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/reachinbox` | PostgreSQL connection URL (falls back to pg-mem if unreachable) |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis host & port for BullMQ & rate limiting |
| `ELASTICSEARCH_URL` | `http://127.0.0.1:9200` | Elasticsearch host (falls back to DB ILIKE if offline) |
| `GOOGLE_CLIENT_ID` | `""` | Google Cloud OAuth Client ID (optional for local demo mode) |
| `GOOGLE_CLIENT_SECRET` | `""` | Google Cloud OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:5000/api/auth/google/callback` | Authorized Google OAuth redirect URI |
| `SLACK_CLIENT_ID` | `""` | Slack App OAuth Client ID |
| `SLACK_CLIENT_SECRET` | `""` | Slack App OAuth Client Secret |
| `SLACK_REDIRECT_URI` | `http://localhost:5000/api/slack/callback` | Authorized Slack redirect URI |
| `JWT_SECRET` | `reachinbox_secret_jwt_token_2026` | Secret key for signing session tokens |
| `COOKIE_SECRET` | `reachinbox_cookie_secret_2026` | Secret key for signed cookies |
| `WORKER_CONCURRENCY` | `5` | Maximum simultaneous jobs processed by the BullMQ worker |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | `2000` | Minimum stagger interval in milliseconds between batch emails |

---

## 🔑 External Integrations Setup Guide

### 1. Google OAuth 2.0
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and go to **APIs & Services** &rarr; **Credentials**.
3. Click **Create Credentials** &rarr; **OAuth Client ID**.
4. Application Type: **Web application**.
5. Set **Authorized redirect URIs** to:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
6. Copy the **Client ID** and **Client Secret** into `.env`.
> **Note for Local Testing:** If Google OAuth credentials are not provided, click **"Launch Demo Recruiter Session"** on the login page to immediately log in with an authenticated session.

### 2. Slack OAuth & Webhook Integration
You can connect Slack in two ways:
- **Direct Incoming Webhook (Zero Setup)**:
  1. In any Slack workspace, go to Apps &rarr; **Incoming WebHooks**.
  2. Click **Add New Webhook to Workspace**, select a channel (e.g., `#email-alerts`), and copy the webhook URL.
  3. Open ReachInbox, click **"Connect Slack"** in the top navigation, paste the webhook URL, and click **"Save Webhook"**.
  4. Click **"Test Alert"** to send a live test notification to your Slack channel!
- **Slack OAuth 2.0**:
  1. Go to [Slack API: Your Apps](https://api.slack.com/apps) and create an app.
  2. Under **OAuth & Permissions**, add `incoming-webhook` and `chat:write` scopes.
  3. Set Redirect URL to `http://localhost:5000/api/slack/callback`.
  4. Paste `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` into `.env`.

### 3. Nodemailer & Ethereal SMTP
**No manual credentials required!**
On server startup, the backend calls `nodemailer.createTestAccount()` to automatically provision real Ethereal SMTP accounts with full credentials. Every dispatched email includes a clickable **"Ethereal Preview"** link in the dashboard to inspect the email exactly as it appears in the recipient's inbox.

### 4. Elasticsearch
1. By default, the application connects to `http://localhost:9200`.
2. If Elasticsearch is running, emails are automatically indexed into the `reachinbox_emails` index.
3. If Elasticsearch is unreachable, the system automatically falls back to PostgreSQL `ILIKE` searching without any disruption or errors.

---

## 📊 Bull Board Queue Monitor

ReachInbox includes the official Bull Board interface mounted at:
```
http://localhost:5000/admin/queues
```
Here you can:
- View active, delayed, waiting, and completed BullMQ jobs.
- Inspect job payloads (`recipient`, `delayMs`, `hourlyLimit`).
- Manually retry, promote, or remove delayed jobs.

---

## 🛡️ Core Reliability Features Explained

### 1. Redis-Backed Atomic Per-Sender Hourly Rate Limiting
Rate limiting is executed atomically in Redis using an embedded Lua script:
```lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local current = redis.call('INCR', key)
if current == 1 then
    redis.call('EXPIRE', key, 3600)
end
if current > limit then
    return {0, current}
else
    return {1, current}
end
```
- **Atomicity**: Incrementation and expiration are executed atomically within Redis. No race conditions can occur between multiple concurrent worker threads.
- **Automatic Rescheduling**: When `allowed == 0`, the BullMQ worker updates the database status to `rate_limited`, calculates the exact time until the start of the next hour window, and re-enqueues the job with that delay.
- **Slack Alerting**: On the first breach of an hourly limit, a Slack alert is delivered with the sender's details and the rescheduled time.

### 2. Duplicate Prevention and Idempotency
- When an email batch is scheduled, an `idempotency_key` is generated based on the user ID, recipient, subject, and target time.
- PostgreSQL enforces a `UNIQUE` constraint on `idempotency_key` with `ON CONFLICT DO NOTHING`.
- The worker verifies the email status before sending: if already marked `sent`, execution is skipped.

### 3. Restart Persistence and Startup Reconciliation
- BullMQ delayed jobs are saved in Redis sorted sets and survive server restarts.
- If Redis is ever restarted or flushed, `reconcileScheduledJobs()` scans PostgreSQL for any emails marked `scheduled` or `rate_limited` and restores their jobs to the BullMQ queue with the remaining delay calculated from `Date.now()`.

---

## 📂 Repository Structure

```
reachinbox-scheduler/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts               # Centralized configuration & environment loader
│   │   ├── db/
│   │   │   ├── db.ts                # PostgreSQL pool with automatic pg-mem fallback
│   │   │   ├── schema.sql           # SQL tables for users, senders, and emails
│   │   │   └── migrate.ts           # Schema migration & initial Ethereal account seed
│   │   ├── middleware/
│   │   │   └── auth.ts              # JWT authentication & session middleware
│   │   ├── queue/
│   │   │   ├── emailQueue.ts        # BullMQ queue definition & delayed job adder
│   │   │   ├── emailWorker.ts       # BullMQ worker process with rate limit handling
│   │   │   ├── reconciliation.ts    # Startup database recovery of missing jobs
│   │   │   └── bullBoard.ts         # Bull Board queue monitor router
│   │   ├── routes/
│   │   │   ├── auth.routes.ts       # Google OAuth & demo session endpoints
│   │   │   ├── email.routes.ts      # CSV parsing, scheduling, search, & history
│   │   │   ├── sender.routes.ts     # SMTP senders management & Ethereal generator
│   │   │   └── slack.routes.ts      # Slack OAuth, webhook connection, & alerts
│   │   ├── services/
│   │   │   ├── ethereal.ts          # Nodemailer transporter & preview generator
│   │   │   ├── elasticsearch.ts     # Elasticsearch client with PostgreSQL fallback
│   │   │   ├── rateLimiter.ts       # Redis Lua atomic hourly rate limiter
│   │   │   ├── redis.ts             # Redis connection manager
│   │   │   └── slack.ts             # Slack webhook alerting service
│   │   ├── test/
│   │   │   └── run-tests.ts         # Automated test suite (12 requirements verified)
│   │   ├── index.ts                 # Express API server entry point
│   │   ├── worker.ts                # Standalone BullMQ worker entry point
│   │   └── dev-all.ts               # Unified API + Worker dev runner
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ComposeModal.tsx     # CSV upload, recipients, subject, body, limits
│   │   │   ├── EmailTable.tsx       # Scheduled and Sent emails with Ethereal links
│   │   │   ├── LoginCard.tsx        # Google OAuth & Demo sign-in card
│   │   │   ├── Navbar.tsx           # Branding, Bull Board link, Slack pill, logout
│   │   │   └── SlackModal.tsx       # Slack OAuth / Webhook configuration modal
│   │   ├── services/
│   │   │   └── api.ts               # Axios client for backend API
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript interfaces (User, Sender, EmailJob)
│   │   ├── App.tsx                  # Main dashboard layout, tabs, & live search
│   │   ├── index.css                # Tailwind CSS imports
│   │   └── main.tsx                 # React DOM mount point
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── samples/
│   ├── recipients.csv               # Sample CSV file for testing recipient uploads
│   └── recipients.txt               # Sample TXT file for testing recipient uploads
├── scripts/
│   ├── start-all.bat                # Windows batch launcher for all services
│   ├── start-all.ps1                # PowerShell launcher for all services
│   └── start-redis.bat              # Standalone Redis launcher
├── .env.example                     # Example environment variables template
├── .gitignore                       # Clean Git ignore rules (no secrets/node_modules)
├── package.json                     # Root orchestrator scripts
└── README.md                        # Documentation & setup instructions
```

---

## 🧪 Submission Checklist

- [x] Tech stack: React + Vite + TypeScript + Tailwind CSS
- [x] Backend: Node.js + Express + TypeScript + PostgreSQL (`pg`)
- [x] Queue: BullMQ + Redis delayed jobs (no cron jobs)
- [x] Worker: Separate BullMQ worker process with configurable concurrency
- [x] Rate Limiting: Redis-backed atomic per-sender hourly limits
- [x] Auto-Rescheduling: Reschedules delayed jobs to the next hour upon breach
- [x] Slack Integration: Slack OAuth 2.0 & Incoming Webhook alerts
- [x] SMTP: Nodemailer + Ethereal SMTP with viewable preview URLs
- [x] Search: Elasticsearch indexing with resilient PostgreSQL fallback
- [x] Duplicate Prevention: Database idempotency keys (`ON CONFLICT DO NOTHING`)
- [x] Restart Persistence: BullMQ Redis persistence + PostgreSQL startup reconciliation
- [x] Monitoring: Bull Board mounted at `/admin/queues`
- [x] Frontend Design: Matches Figma layout (tabs, search, compose modal, user profile)
- [x] Automated Tests: 12/12 requirements tested and passing
