# Complete Car Loans (CCL) – Real-Data Testing Guide

This guide walks you through setting up and end-to-end testing of the CCL system
with live Mailgun and OpenRouter services, and a local PostgreSQL database
managed via Docker Compose. Follow each section in order to guarantee a
reproducible, production-like test environment.

---

## 1. Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18.x or higher.
- **npm** (or **pnpm**): For managing project dependencies. Examples will use
  `npm`.
- **Docker** and **Docker Compose**: For running local development services
  (PostgreSQL, Redis, MailHog).
- **Git**: For cloning the repository.
- **A Mailgun Account**: With a configured sending domain (sandbox or verified).
- **An OpenRouter Account**: For AI agent responses.
- **`tsx` globally or as a dev dependency**: For running TypeScript scripts
  directly (`npm install -g tsx` or ensure it's in `devDependencies`).
- **`drizzle-kit` globally or as a dev dependency**: For database migrations
  (`npm install -g drizzle-kit` or ensure it's in `devDependencies`).

---

## 2. Environment Setup

### 2.1. Clone Repository and Install Dependencies

```bash
git clone https://github.com/copp1723/CCL.git
cd CCL
npm install
```

### 2.2. Configure Environment Variables

1.  **Copy the example environment file:**
    ```bash
    cp .env.example .env
    ```
2.  **Edit the `.env` file** with your actual credentials and settings. Open
    `.env` in your preferred text editor.

    **Key variables to set:**

    ```dotenv
    # General
    NODE_ENV=development
    PORT=5000
    BASE_URL=http://localhost:5000 # Important for webhook URLs and OpenRouter referer
    FRONTEND_URL=http://localhost:5173 # If you have a separate frontend

    # Database (Ensure this matches your Docker Compose setup or external DB)
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ccl

    # Security (Generate strong, unique keys)
    ENCRYPTION_KEY=your-secure-32-byte-base64-encryption-key # e.g., openssl rand -base64 32
    API_KEY=your-strong-internal-api-key
    CCL_API_KEY=your-strong-ccl-api-key # Can be the same as API_KEY
    JWT_SECRET=your-secure-jwt-secret
    SESSION_SECRET=your-secure-session-secret

    # AI Service (OpenRouter)
    OPENROUTER_API_KEY=your-openrouter-api-key # Get from https://openrouter.ai/keys

    # Email Service (Mailgun)
    MAILGUN_API_KEY=your-mailgun-private-api-key # Found in Mailgun settings
    MAILGUN_DOMAIN=your-mailgun-sending-domain # e.g., sandboxXXX.mailgun.org or your verified domain

    # CORS (Adjust if your frontend runs on a different port/domain)
    CORS_ORIGIN=http://localhost:5173

    # Redis (Ensure this matches your Docker Compose setup)
    # REDIS_URL=redis://:yoursecurepassword@localhost:6379/0 # Uncomment and set password if using Redis
    ```

    Refer to `.env.example` for a full list of available variables and their
    descriptions.

### 2.3. Start Local Development Services with Docker Compose

The project includes a Docker Compose file to easily run PostgreSQL, Redis
(optional), and MailHog (for email testing).

1.  **Navigate to the scripts directory (if the compose file is there) or stay
    in the root if `scripts/dev-compose.yml` is referenced from root.** The
    provided `scripts/dev-compose.yml` should be run from the project root.

2.  **Start the services in detached mode:**

    ```bash
    docker compose -f scripts/dev-compose.yml up -d
    ```

    This will start:

    - **PostgreSQL**: On port `5432`, database `ccl`, user `postgres`, password
      `postgres`.
    - **Redis**: On port `6379` (if enabled in `dev-compose.yml` and configured
      in `.env`). The example compose file uses `yoursecurepassword`.
    - **MailHog**: SMTP server on port `1025`, Web UI on port `8025`.

3.  **Verify services are running:**

    ```bash
    docker compose -f scripts/dev-compose.yml ps
    ```

    You should see `ccl-postgres`, `ccl-redis` (if enabled), and `ccl-mailhog`
    with `Up` status.

    - Access MailHog UI: `http://localhost:8025`
    - You can connect to PostgreSQL using a DB client like DBeaver or `psql`
      with the credentials from your `.env` and `dev-compose.yml`.

---

## 3. Database Setup and Migrations

### 3.1. Create Database (If First Time with Docker Volume)

The Docker Compose setup for PostgreSQL should automatically create the `ccl`
database if it doesn't exist, based on the `POSTGRES_DB: ccl` environment
variable in `scripts/dev-compose.yml`.

If you are using an external PostgreSQL server or need to create it manually
within Docker:

```bash
# Connect to the running PostgreSQL container
docker exec -it ccl-postgres psql -U postgres

# Inside psql prompt:
CREATE DATABASE ccl;
\q
```

### 3.2. Run Database Migrations

Drizzle ORM is used for database schema management. Migrations are located in
the `migrations/` directory.

1.  **Ensure your `DATABASE_URL` in `.env` is correctly pointing to your
    PostgreSQL instance.**
2.  **Apply migrations:**
    ```bash
    npm run db:migrate
    ```
    This command executes `drizzle-kit migrate`. You should see output
    indicating which migrations were applied. If it's the first time, all
    migrations will run. Subsequent runs will only apply new migrations.

### 3.3. Verify Database Connection (Optional - Handled by Setup Script)

You can test the connection by running a simple query if needed, but the setup
script in the next step will also do this.

```bash
# Example: List tables (after migrations)
docker exec -it ccl-postgres psql -U postgres -d ccl -c "\dt"
```

---

## 4. Automated Setup Script (Recommended)

The project includes a script to automate several setup steps, including
environment checks, DB connection tests, migrations, and data seeding.

**Run the setup script:**

```bash
npm run setup:real-data-testing
# OR directly:
# tsx scripts/setup-real-data-testing.ts
```

This script will:

- Verify required environment variables.
- Test the database connection.
- Run database migrations (if `drizzle.config.ts` is found and migrations are
  pending).
- Seed the database with test data using `scripts/seed-test-data.ts`.
- Validate connectivity to Mailgun and check OpenRouter configuration.
- Provide next steps.

Review the output of this script carefully. If any step fails, address the
reported issues before proceeding.

---

## 5. Manual Data Seeding (If not using the setup script or for specific seeding)

If you prefer to seed data manually or need to re-seed:

```bash
npm run seed -- --full          # Full reset (if --clean is supported by script) & seed
# OR for specific parts:
# npm run seed -- --leads-only
# npm run seed -- --conversations
# npm run seed -- --campaigns
```

This script populates the database with:

- Sample system agents.
- Leads from `test_leads.csv`.
- Visitor records for these leads.
- Sample chat sessions and conversation histories.
- Campaign schedules and attempts.
- System activities.

You can inspect the database using a tool like DBeaver or `psql` to verify data
insertion. Example:

```bash
docker exec -it ccl-postgres psql -U postgres -d ccl -c "SELECT COUNT(*) FROM system_leads;"
docker exec -it ccl-postgres psql -U postgres -d ccl -c "SELECT email FROM visitors LIMIT 5;"
```

---

## 6. Mailgun Configuration for Receiving Emails

To test the full conversation flow where leads reply to emails, you need to
configure Mailgun to forward incoming emails to your application's webhook
endpoint.

### 6.1. Expose Your Local Server (for Local Development)

Mailgun needs a publicly accessible URL to send webhooks. If you're developing
locally, use a tool like **ngrok**.

1.  **Install ngrok** (if you haven't already):
    [https://ngrok.com/download](https://ngrok.com/download)
2.  **Start ngrok to expose your local server's port (e.g., 5000):**
    ```bash
    ngrok http 5000
    ```
3.  **Note the `Forwarding` URL** provided by ngrok (e.g.,
    `https://xxxx-xx-xxx-xx-xx.ngrok-free.app`). This will be your
    `<public-url>`.

### 6.2. Configure Mailgun Route or Receiving Endpoint

In your Mailgun dashboard:

1.  Navigate to **Receiving**.
2.  Click **Create route** (or manage existing routes).
3.  **Expression Type**: Choose `Match Recipient`.
4.  **Recipient**: Enter an email address on your Mailgun domain that you'll use
    for testing replies (e.g., `replies@your.mailgundomain.com`).
5.  **Actions**:
    - Check **Forward**.
    - Enter your webhook URL: `<public-url>/api/webhooks/email-reply` (e.g.,
      `https://xxxx-xx-xxx-xx-xx.ngrok-free.app/api/webhooks/email-reply`)
    - Ensure Mailgun sends the full MIME message or at least `sender`,
      `subject`, and `stripped-text` (plain text body). The current webhook
      handler in `server/routes/webhooks.ts` expects these fields.
6.  **Description**: Add a descriptive name for the route.
7.  **Save** the route.

**Important**: If using MailHog locally for _sending_ emails during tests (by
configuring Mailgun SMTP settings in your app to point to `localhost:1025`),
ensure that for _receiving_ replies, Mailgun is still configured to hit your
application's public webhook URL.

---

## 7. Start the Application Server

Now that your environment, database, and services are configured, start the CCL
application:

```bash
npm run dev
```

This command typically runs `tsx server/index.ts` in development mode. Monitor
the console output for:

- Successful server startup message (e.g., `✅ Server running on port 5000...`).
- Database connection confirmation.
- Campaign worker startup.
- Any error messages.

---

## 8. Step-by-Step Testing Scenarios

Ensure your server is running and Mailgun webhooks are configured correctly.

### Scenario A: Initial Lead Ingestion and Welcome Email (Conceptual)

_This scenario assumes a welcome email is triggered upon lead creation. If not,
adapt to test the first email sent by a campaign._

1.  **Trigger Lead Creation**:
    - If you have a CSV upload feature, use it with `test_leads.csv`.
    - Alternatively, manually create a lead via an API endpoint if available, or
      rely on the seeded data.
2.  **Verify Lead in Database**: Check the `system_leads` and `visitors` tables.
3.  **Check MailHog/Mailgun Logs**:
    - If using MailHog for outgoing mail (by setting SMTP to `localhost:1025` in
      `.env` for Mailgun service), open `http://localhost:8025` to see if the
      welcome email was "sent".
    - If using actual Mailgun, check your Mailgun dashboard logs for an outgoing
      email to the lead's address.
4.  **Simulate Lead Reply**:
    - From the lead's email address (e.g., `john.doe@example.com` from seeded
      data), send an email to the address you configured in Mailgun for
      receiving (e.g., `replies@your.mailgundomain.com`).
    - Subject: `Re: Your Auto Loan Application [Thread:SEED_LEAD_ID_OR_TOKEN]`
      (or any subject if your system handles new threads).
    - Body: "I'm interested, tell me more."
5.  **Observe Application Behavior**:
    - Check server console logs for webhook processing messages (e.g.,
      `Processing email reply from john.doe@example.com...`).
    - Verify a new `chat_sessions` entry or update.
    - Verify an `outreach_attempts` entry for the agent's reply.
6.  **Check MailHog/Mailgun for Agent's Reply**: See if Cathy's (the agent)
    reply was sent back to `john.doe@example.com`.

### Scenario B: Agent Conversation & Phone Number Capture

1.  **Continue from Scenario A**: After the agent's first reply, send another
    email _as the lead_:
    - To: `replies@your.mailgundomain.com`
    - Subject: Must correctly reference the ongoing thread (e.g., include
      `[Thread:XYZ]`).
    - Body: "My credit isn't great, can I still get a loan? My phone number is
      555-123-4567."
2.  **Observe Application Behavior**:
    - Server logs should show the reply being processed.
    - The agent (OpenRouter) should generate a contextual response.
    - The `system_leads` table status for this lead should update to `qualified`
      because a phone number was provided.
    - The `chat_sessions` table should show the continued conversation.
3.  **Check MailHog/Mailgun**: Verify the agent's next reply is sent.

### Scenario C: Campaign Automation (Scheduled Follow-ups)

1.  **Identify a Seeded Lead with a Campaign**: The seed script should set up
    some leads in campaigns. Check `campaign_attempts` table.
2.  **Ensure Campaign Worker is Running**: The server startup logs should
    indicate `Campaign sender worker started`.
3.  **Trigger Campaign Processing (if needed or wait)**:
    - The worker runs periodically (e.g., every minute or hour). You might need
      to wait or have a manual trigger endpoint.
    - The `server/workers/campaign-sender.ts` processes attempts where
      `scheduled_for` is in the past and `status` is `scheduled`.
4.  **Observe**:
    - Server logs should show the campaign worker picking up and processing
      scheduled emails.
    - `campaign_attempts` status should update to `sent` or `failed`.
    - Check MailHog/Mailgun for the outgoing campaign emails.
5.  **Simulate Reply to Campaign Email**: Similar to Scenario A, reply to a
    campaign email and verify the conversation picks up correctly.

### Scenario D: WebSocket Real-Time Chat

1.  **Connect a WebSocket Client**: Use a tool like Postman, `wscat`, or a
    simple HTML page with JavaScript to connect to `ws://localhost:PORT/ws/chat`
    (e.g., `ws://localhost:5000/ws/chat`).
2.  **Send a Chat Message**:
    ```json
    {
      "type": "chat",
      "content": "Hello, I need help with a car loan.",
      "sessionId": "ws-test-session-123"
    }
    ```
3.  **Observe Server Logs**: Check for WebSocket connection and message
    processing.
4.  **Observe WebSocket Client**: You should receive a response from "Cathy"
    (the AI agent).
    ```json
    {
      "type": "chat",
      "sender": "agent",
      "content": "Hi there! I'm Cathy from Complete Car Loans...",
      "timestamp": "..."
    }
    ```
5.  **Verify Activity Logging**: Check `system_activities` or `storageService`
    logs for `ws_chat_message` entries.

---

## 9. Troubleshooting Common Issues

- **`DATABASE_URL not configured` / Database Connection Errors**:

  - Ensure `.env` file exists and `DATABASE_URL` is correctly set.
  - Verify PostgreSQL Docker container (`ccl-postgres`) is running: `docker ps`.
  - Check Docker container logs: `docker logs ccl-postgres`.
  - Ensure port `5432` is not blocked by a firewall.

- **Migration Failures (`npm run db:migrate` fails)**:

  - Check error messages from Drizzle Kit. Often due to incorrect `DATABASE_URL`
    or database not being accessible.
  - Ensure the `postgres` user has permissions to create/alter tables in the
    `ccl` database.
  - If "database already exists" and you want a clean slate, manually drop and
    recreate the DB (BE CAREFUL: THIS DELETES ALL DATA).

- **Missing Environment Variables (e.g., API Keys)**:

  - The application will log warnings or errors if essential keys like
    `OPENROUTER_API_KEY` or `MAILGUN_API_KEY` are missing. Double-check your
    `.env` file.

- **Mailgun Issues**:

  - **Emails not sending**: Check Mailgun dashboard logs for errors. Ensure your
    domain is verified (or you're using the sandbox domain correctly with
    authorized recipients). API key might be incorrect or have insufficient
    permissions.
  - **Webhooks not received**:
    - Verify your ngrok tunnel is active and the URL is correctly configured in
      Mailgun routes.
    - Check Mailgun webhook logs for delivery attempts and errors.
    - Ensure your server's `/api/webhooks/email-reply` endpoint is functional
      and not erroring. Check server logs.
    - Firewall might be blocking incoming ngrok requests.

- **OpenRouter/AI Agent Issues**:

  - **No AI response or generic fallback**: `OPENROUTER_API_KEY` might be
    missing, invalid, or out of credits. Check server logs for API errors from
    OpenRouter.
  - Ensure the model specified (e.g., `openai/gpt-4o-mini` or
    `anthropic/claude-3.5-sonnet`) is accessible with your key.

- **Campaign Emails Not Sending**:

  - Verify `campaignSender` worker is started (check server logs).
  - Check `campaign_attempts` table: Are there entries with `status='scheduled'`
    and `scheduled_for` in the past?
  - Ensure Mailgun is configured and working.

- **`cross-env: command not found`**:

  - `cross-env` might not be installed globally or as a dev dependency. Run
    `npm install --save-dev cross-env`.

- **`tsx: command not found`**:

  - `tsx` might not be installed globally or as a dev dependency. Run
    `npm install --save-dev tsx`.

- **Docker Compose Issues**:
  - **`ERROR: for postgres Cannot start service postgres... port is already allocated`**:
    Another service (or an old Docker container) is using port 5432. Stop it or
    change the port mapping in `dev-compose.yml`.
  - Check logs for individual services: `docker logs ccl-postgres`,
    `docker logs ccl-redis`, `docker logs ccl-mailhog`.

---

### General Debugging Tips:

- **Check Server Logs**: Your primary source of information. Increase log level
  in `.env` (`LOG_LEVEL=debug`) if needed.
- **Use `REAL_DATA_TESTING_GUIDE.md`**: This guide!
- **Test Incrementally**: If something breaks, revert the last change or test
  components in isolation.
- **Verify `.env` loading**: Ensure your application correctly loads and parses
  the `.env` file (e.g., `config/environment.ts` is working).

---

Good luck with your testing! This setup should provide a robust environment for
validating the CCL system's core conversation functionalities.
