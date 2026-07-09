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
- Combined output is dynamically appended to comments and Slack payloads.

### 3. Multi-Tenant Custom Slack Webhooks
- Custom Slack Webhook URLs can be defined on a per-rule basis.
- **Fallback Guardrails**: Automatically uses `process.env.SLACK_WEBHOOK_URL` if a rule-specific URL is omitted. Gracefully skips notification logs if no endpoints are configured.

### 4. Real-Time Event Log Dashboard
- Modern dark/purple glassmorphism UI built with TailwindCSS.
- Server-side pre-fetching retrieves the 50 most recent webhook events immediately.
- Client-side polling refreshes the log grid every 5 seconds.
- Tracks execution statuses (`pending`, `processing`, `completed`, `failed`) and actions side-effects.

### 5. Fault-Tolerant Retry Cron Worker
- Runs at `/api/cron/retry` (secured with `CRON_SECRET` tokens).
- Picks up failed webhook events with under 5 attempts, increments count, and retries the process in the background.

### 6. Intelligent Root Route redirection
- Root route `/` acts as a server-side traffic controller.
- Autocomplete redirects authenticated session holders to `/dashboard` and routes unsigned visitors to `/dashboard` (presenting the sign-in screen).

---

## 🛠️ Architecture & Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Actions, Server Components).
- **Authentication**: [NextAuth.js](https://next-auth.js.org/) with GitHub OAuth provider. Automatically persists and refreshes repository scopes.
- **ORM & Database**: [Drizzle ORM](https://orm.drizzle.team/) running over stateless HTTP using `@neondatabase/serverless` (fully compliant with blocked port `5432` environments).
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

## 🚀 Getting Started

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

### 2. Install Dependencies
```bash
npm install
```

### 3. Push Database Schema
```bash
# In restricted environments, migrations can be run manually using neon-http.
# Drizzle Kit CLI can push directly if port 5432 is open:
npx drizzle-kit push
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📡 Webhook Processor & Worker Endpoints

### 1. GitHub Webhook Receiver (`POST /api/webhooks/github`)
Incoming webhooks from GitHub are verified against the repository's `webhookSecret` and added to the `event` table, triggering background processing in [lib/processor.ts](file:///media/gaurav/Local%20Disk/github-automation/github-bot/lib/processor.ts).

### 2. Retry Cron Endpoint (`GET /api/cron/retry`)
To simulate cron scheduling or trigger a retry:
```bash
curl -I "http://localhost:3000/api/cron/retry?token=YOUR_CRON_SECRET"
```
Or include the token as a Bearer authorization header:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" -I "http://localhost:3000/api/cron/retry"
```
