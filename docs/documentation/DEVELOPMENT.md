# Development Guide

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities
├── server/                 # Node.js backend
│   ├── agents/             # AI agent implementations
│   ├── routes/             # API route handlers
│   ├── middleware/         # Express middleware
│   ├── services/           # External API integrations
│   └── utils/              # Backend utilities
├── shared/                 # Shared types and schemas
├── config/                 # Configuration files
├── docs/                   # Documentation
├── scripts/                # Build and deployment scripts
└── tests/                  # Test files
```

## Development Workflow

1. **Start Development Server**

   ```bash
   npm run dev
   ```

2. **Code Quality Checks**

   ```bash
   npm run check      # TypeScript validation
   npm run lint       # ESLint checks
   npm run format     # Prettier formatting
   ```

3. **Testing**
   ```bash
   npm test           # Run test suite
   npm run test:watch # Watch mode
   ```

## AI Agents

The system includes several specialized AI agents:

- **Visitor Identifier** - Tracks website visitors
- **Realtime Chat** - Handles customer conversations
- **Lead Packaging** - Processes and packages leads
- **Email Reengagement** - Manages email campaigns

## API Endpoints

- `GET /api/system/health` - System health check
- `GET /api/agents/status` - Agent status information
- `POST /api/chat` - Chat with AI agent
- `GET /api/leads` - Retrieve leads data
- `POST /api/email-campaigns/bulk-send` - Send email campaigns

## Security

All API endpoints require authentication via `x-api-key` header except:

- `/health` - Public health check
- Static assets

## Debugging

Enable debug mode:

```bash
DEBUG=* npm run dev
```
