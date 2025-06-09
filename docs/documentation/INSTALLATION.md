# Installation Guide

## Prerequisites

- Node.js 20.x or higher
- npm or yarn
- PostgreSQL 13+ (optional, uses in-memory storage by default)

## Quick Setup

1. **Clone and Install**

   ```bash
   npm install
   ```

2. **Environment Configuration**

   ```bash
   cp config/environments/.env.example .env
   # Edit .env with your API keys
   ```

3. **Start Development Server**

   ```bash
   npm run dev
   ```

4. **Access Application**
   - Frontend: http://localhost:24678
   - Backend API: http://localhost:5000
   - Health Check: http://localhost:5000/health

## Environment Variables

### Required

- `OPENAI_API_KEY` - OpenAI API key for AI agents
- `MAILGUN_API_KEY` - Mailgun API key for email sending
- `MAILGUN_DOMAIN` - Your verified Mailgun domain

### Optional

- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment (development/staging/production)
- `PORT` - Server port (default: 5000)

## Verification

Test the installation:

```bash
curl http://localhost:5000/health
```

Should return system health status.
