# CCL Environment Setup: Quick Start & Testing Guide

This document provides a concise summary of the environment setup accomplishments and the immediate next steps to begin testing the Complete Car Loans (CCL) application with real data.

---

## 🚀 What We've Accomplished

The CCL development environment has been significantly enhanced and prepared for robust real-data testing. Key accomplishments include:

1.  **Automated Setup Script**:
    *   A new script `scripts/setup-real-data-testing.ts` (run via `npm run setup:real-data-testing`) automates critical setup tasks:
        *   Environment variable checks.
        *   Database connection testing.
        *   Database migration execution.
        *   Test data seeding.
        *   Essential service connectivity validation (Mailgun, OpenRouter).

2.  **Local Development Services (Docker Compose)**:
    *   A `scripts/dev-compose.yml` file is provided to easily spin up local instances of:
        *   **PostgreSQL**: For the application database.
        *   **Redis**: (Optional, if features requiring it are enabled) For caching or job queues.
        *   **MailHog**: For capturing and viewing emails sent by the application locally during development.

3.  **Database Management**:
    *   **Migrations**: Database schema migrations are located in the `migrations/` directory and managed by Drizzle Kit. The setup script attempts to run these.
    *   **Data Seeding**: A comprehensive seed script `scripts/seed-test-data.ts` (run via `npm run seed -- --full` or by the setup script) populates the database with realistic sample data for agents, leads, conversations, and campaigns.

4.  **Repository Cleanup & Hardening**:
    *   **Security**: Critical vulnerabilities, including hardcoded secrets, have been addressed. `.env.example` now uses placeholders.
    *   **Dependencies**: Unused dependencies were removed, and missing ones added. `package.json` is clean.
    *   **Code Quality**: TypeScript errors were resolved, and duplicate/obsolete files were removed, improving maintainability.

5.  **Server Readiness**:
    *   The main server entry point `server/index.ts` has been updated to a runnable state, integrating core services like storage, logging, and basic API routes.

6.  **Comprehensive Testing Guide**:
    *   The `REAL_DATA_TESTING_GUIDE.md` has been updated with detailed instructions for environment setup, service configuration (Mailgun, OpenRouter, ngrok), and step-by-step testing scenarios for the conversation workflow.

---

## 🏁 Next Immediate Steps to Start Testing

Follow these steps to get your local environment running and begin testing:

1.  **Clone Repository (if new)**:
    ```bash
    git clone https://github.com/copp1723/CCL.git
    cd CCL
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    *   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    *   Edit the `.env` file with your actual API keys and settings for `DATABASE_URL`, `OPENROUTER_API_KEY`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `BASE_URL`, etc. Refer to `.env.example` and `REAL_DATA_TESTING_GUIDE.md` for details.

4.  **Run Automated Setup Script**:
    *   This is the **recommended** way to prepare your database and check configurations.
        ```bash
        npm run setup:real-data-testing
        ```
    *   This script will guide you through checks, run migrations, and seed data. Review its output for any errors.

5.  **Start Local Services (if not already running via setup script or manually preferred)**:
    ```bash
    docker compose -f scripts/dev-compose.yml up -d
    ```
    *   Verify services (Postgres, MailHog) are running: `docker compose -f scripts/dev-compose.yml ps`

6.  **Start the Application Server**:
    ```bash
    npm run dev
    ```
    *   Monitor the console for startup messages and any errors. The server should typically run on `http://localhost:5000`.

7.  **Begin Testing**:
    *   Refer to the **Step-by-Step Testing Scenarios** in `REAL_DATA_TESTING_GUIDE.md` to test lead ingestion, email replies, agent conversations, and campaign automation.
    *   Use MailHog (`http://localhost:8025`) to inspect emails sent locally.
    *   If testing live Mailgun webhooks, ensure ngrok (or a similar tool) is set up to expose your local server, and Mailgun routes are configured as per the main guide.

---

## ⚙️ Key Services to Configure (in `.env`)

Ensure these are correctly set up for full functionality:

1.  **Database (`DATABASE_URL`)**:
    *   Defaults to `postgresql://postgres:postgres@localhost:5432/ccl` for the Docker Compose setup. Adjust if using an external PostgreSQL instance.

2.  **Mailgun (`MAILGUN_API_KEY`, `MAILGUN_DOMAIN`)**:
    *   Essential for sending emails and receiving replies via webhooks.
    *   A Mailgun "Receiving Route" must be configured to forward emails to your application's webhook endpoint (e.g., `YOUR_PUBLIC_URL/api/webhooks/email-reply`).

3.  **OpenRouter (`OPENROUTER_API_KEY`)**:
    *   Required for AI agent responses in chat and email conversations.

4.  **Base URL (`BASE_URL`)**:
    *   Important for constructing correct webhook URLs and for the OpenRouter `HTTP-Referer` header. Set to your public URL (e.g., ngrok URL) if testing live webhooks, or `http://localhost:PORT` for local-only.

5.  **Frontend URL (`FRONTEND_URL`)**:
    *   Used for CORS configuration and potentially by OpenRouter. Set to where your client application runs (e.g., `http://localhost:5173`).

---

## 🛠️ Quick Reference: Key Commands

*   **Install Dependencies**:
    ```bash
    npm install
    ```
*   **Create `.env` file**:
    ```bash
    cp .env.example .env
    ```
*   **Start Local Docker Services (Postgres, MailHog)**:
    ```bash
    docker compose -f scripts/dev-compose.yml up -d
    ```
*   **Stop Local Docker Services**:
    ```bash
    docker compose -f scripts/dev-compose.yml down
    ```
*   **Run Database Migrations (Manual)**:
    ```bash
    npm run db:migrate
    ```
*   **Seed Database (Manual Full Seed)**:
    ```bash
    npm run seed -- --full
    ```
*   **Run Automated Setup (Recommended)**:
    ```bash
    npm run setup:real-data-testing
    ```
*   **Start Application Server (Development Mode)**:
    ```bash
    npm run dev
    ```
*   **Check TypeScript for Errors**:
    ```bash
    npm run check
    ```
*   **Build for Production**:
    ```bash
    npm run build
    ```
*   **Start Application Server (Production Mode)**:
    ```bash
    npm run start
    ```

---

This quick start guide, along with the more detailed `REAL_DATA_TESTING_GUIDE.md`, should provide everything needed to get the CCL application running with real data and test its core functionalities.
