# Aegis.ai — Intelligent GitHub Triage & Automation Engine

Aegis.ai is a premium, developer-first platform designed to automate GitHub issue triage, manage repository workflows dynamically, and notify stakeholders in real-time. Powered by DeepSeek LLM intelligence and a multi-tenant rules engine, Aegis.ai protects your repository health automatically.

---

## 🌟 Core Features

### 1. Dynamic User-Configurable Rules Engine (CRUD)
- Define granular routing triggers based on incoming GitHub webhook events.
- **Match Fields**: `Title`, `Body`, or `Author`.
- **Match Operations**: `Contains` (substring search), `Equals` (exact match), and `Regex` (regular expressions).
- **Automated Actions**:
  - **Label Management**: Dynamically apply tags like `critical-priority`, `bug`, etc.
  - **Auto-Commenting**: Post markdown templates or welcome instructions onto the issue timeline.
  - **Slack Notifications**: Fire Slack message payloads immediately.
  - **DeepSeek AI Triage**: Process the issue description using state-of-the-art reasoning models.

### 2. DeepSeek LLM AI Triage
- Integrates OpenCode AI running `deepseek-v4-flash-free` to summarize issue context and calculate urgency levels.
- Generates structured JSON responses mapping to:
  - **Summary**: Concise one-paragraph issue breakdown.
  - **Priority**: Urgency rating (`Low`, `Medium`, `High`) and a one-sentence justification.
- Combined output is dynamically embedded directly back into GitHub issue comments and multi-tenant Slack channels.

### 3. Multi-Tenant Custom Slack Webhooks
- Custom Slack Webhook URLs can be defined on a per-rule basis, allowing multiple unique workspaces to use the engine simultaneously.
- **Fallback Guardrails**: Automatically uses `process.env.SLACK_WEBHOOK_URL` if a rule-specific URL is omitted. Gracefully skips notification logs if no endpoints are configured.

### 4. Real-Time Event Log Dashboard
- Modern dark/purple glassmorphism UI built with TailwindCSS.
- Server-side pre-fetching retrieves the 50 most recent webhook events immediately.
- Client-side polling refreshes the log grid every 5 seconds.
- Tracks execution statuses (`pending`, `processing`, `completed`, `failed`) and actions side-effects.

### 5. Fault-Tolerant Retry Cron Worker
- Runs at `/api/cron/retry` (secured with `CRON_SECRET` tokens).
- Picks up failed webhook events with under 5 attempts, increments count, and retries the process in the background.

### 6. Intelligent Root Route Redirection
- Root route `/` acts as a server-side traffic controller.
- Automatically routes active, authenticated session holders directly to `/dashboard`, while safely steering unauthenticated visitors straight to the secure registration/login screen.

---

## 🛠️ Architecture & Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Actions, Server Components).
- **Authentication**: [NextAuth.js](https://next-auth.js.org/) with GitHub OAuth provider. Automatically persists and refreshes repository scopes.
- **ORM & Database**: [Drizzle ORM](https://orm.drizzle.team/) running over stateless HTTP using `@neondatabase/serverless` (fully compliant with blocked port `5432` serverless environments).
- **API Client**: OpenAI SDK initialized to resolve OpenCode's gateway paths with robust error-handling.

---

## 🗄️ Database Schema Layout

Aegis.ai maps tables with snake_case naming conventions:

- **`user`**: User authentication profiles.
- **`account`**: NextAuth OAuth provider configurations and refresh/access tokens.
- **`session`**: Active user sessions.
- **`repository`**: Linked repository metadata and webhook IDs.
- **`rule`**: Rule criteria matching parameters, action labels, comments, and webhook configurations.
- **`event`**: Webhook delivery payloads, execution state, and retry counters.
- **`action`**: Side-effect logs for tracking label inserts, comment replies, Slack alerts, and triage metrics.

---

## 🚀 Getting Started (Local Development)

### 1. Environment Configuration (`.env`)
Create a `.env` file in the `github-bot` folder:
```env
# Database Credentials
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"

# NextAuth Configuration
NEXTAUTH_SECRET="your-random-32-byte-secret"
NEXTAUTH_URL="http://localhost:3000"

# GitHub OAuth App Credentials
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Cron Worker Authentication Token
CRON_SECRET="your-cron-secret-token"

# Fallback Slack Webhook URL
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."

# OpenCode DeepSeek LLM Credentials
OPENCODE_API_KEY="your-opencode-api-key"
OPENCODE_BASE_URL="https://opencode.ai/zen/v1/"
OPENCODE_MODEL_NAME="deepseek-v4-flash-free"

```

### 2. Install Dependencies & Deploy Local Server

```bash
npm install
npx drizzle-kit push
npm run dev

```

---

## ☁️ Production Deployment

Aegis.ai is engineered as a cloud-native application, distributed fully across serverless and stateless infrastructures to deliver maximum availability and zero-maintenance scaling.

### 1. Infrastructure Architecture & Hosting

* **Frontend & Serverless API Gateway**: Deployed globally on [Vercel](https://vercel.com). The application's endpoints are handled entirely via Vercel Edge/Serverless functions, eliminating persistent server overhead.
* **Database Engine**: Hosted on [Neon PostgreSQL](https://neon.tech). Database transport executes completely over standard HTTPS using `@neondatabase/serverless`, bypassing port `5432` corporate firewall constraints and scaling connections dynamically.
* **Live Production URL**: `https://aegis-sooty-nine.vercel.app`

### 2. Live Webhook Routing Integration (Cutting the Proxy)

In production, local developer tools like the Smee client daemon are decoupled entirely. GitHub webhooks communicate securely and directly with our live production cluster:

* **Production Webhook Endpoint**: `https://aegis-sooty-nine.vercel.app/api/webhooks/github`
* **OAuth Callback Alignment**: The production application's GitHub Developer OAuth settings are updated to authorize and process redirects explicitly through:
`https://aegis-sooty-nine.vercel.app/api/auth/callback/github`

### 3. Sub-Hourly Self-Healing Scheduler Workaround

To optimize operational overhead while using a free-tier hosting footprint, Aegis.ai implements an external cron orchestration strategy.

Because Vercel Hobby accounts restrict internal cron triggers to a single execution per day, the self-healing engine is detached from native Vercel crons and bound to an isolated, high-frequency external monitor (**cron-job.org**):

* **Interval**: Triggers precisely every **10 minutes**.
* **Secure Network Payload**: Executes an automated HTTP `GET` request hitting the serverless endpoint using your production security handshake parameter:
`https://aegis-sooty-nine.vercel.app/api/cron/retry?token=YOUR_PRODUCTION_CRON_SECRET`
* **Security Control**: The backend router validates the secret token parameter natively against Vercel's secure environment settings before starting the database processing transaction block.

---

## 📡 Webhook Processor & Worker Endpoints

### 1. GitHub Webhook Receiver (`POST /api/webhooks/github`)

Incoming webhooks from GitHub are verified against the repository's `webhookSecret` and added to the `event` table, triggering background processing in `lib/processor.ts`.

### 2. Retry Cron Endpoint (`GET /api/cron/retry`)

To simulate cron scheduling or trigger a manual retry:

```bash
curl -I "https://aegis-sooty-nine.vercel.app/api/cron/retry?token=YOUR_CRON_SECRET"

```

Or include the token as a Bearer authorization header:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" -I "https://aegis-sooty-nine.vercel.app/api/cron/retry"

```
