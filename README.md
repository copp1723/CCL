# Complete Car Loans - AI Agent System

> A sophisticated multi-agent auto-loan recovery system leveraging advanced AI technologies.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## 📁 Project Structure

```
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and configuration
├── server/                 # Node.js backend application
│   ├── agents/             # AI agent implementations
│   ├── middleware/         # Express middleware
│   ├── services/           # External API integrations
│   └── utils/              # Backend utilities
├── shared/                 # Shared types and schemas
├── docs/                   # Documentation
├── data/                   # Sample data and datasets
├── tests/                  # Test files
└── scripts/                # Build and deployment scripts
```

## 🤖 AI Agents

1. **Visitor Identifier** - Tracks website visitors
2. **Realtime Chat** - Handles customer conversations
3. **Credit Check** - Processes credit applications
4. **Email Reengagement** - Manages email campaigns
5. **Lead Packaging** - Prepares leads for CRM

## 📚 Documentation

- [Deployment Guide](docs/DEPLOYMENT.md)
- [API Integration](docs/API_INTEGRATION_GUIDE.md)
- [Security Report](docs/SECURITY_AUDIT_REPORT.md)
- [Production Readiness](docs/PRODUCTION_READINESS_REPORT.md)

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI Agents SDK
- **Email**: Mailgun integration

## 🚦 Environment Status

- **Development**: Ready
- **Staging**: `https://ccl-staging.replit.app`
- **Production**: `https://ccl-agents.replit.app`

## 📄 License

MIT License

## Features

- **Multi-Agent AI System**: 5 specialized agents working together for optimal lead recovery
- **Real-time Chat**: Intelligent customer interaction with seamless handoffs
- **Email Campaigns**: Automated re-engagement sequences with Mailgun integration
- **Credit Checking**: FlexPath API integration for instant credit assessments
- **Data Processing**: Flexible APIs for bulk uploads and real-time processing
- **Comprehensive Monitoring**: Real-time agent status and performance metrics

## Architecture

### AI Agents

1. **Visitor Identifier Agent**: Tracks and identifies website visitors
2. **Realtime Chat Agent**: Handles customer conversations with empathy
3. **Credit Check Agent**: Processes credit applications via FlexPath
4. **Email Reengagement Agent**: Manages automated email campaigns
5. **Lead Packaging Agent**: Prepares and submits leads to dealer CRM

### Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI Agents SDK
- **Email**: Mailgun integration
- **Deployment**: Replit with CI/CD via GitHub Actions

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- PostgreSQL database
- Required API keys (OpenAI, Mailgun, FlexPath)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ccl-agents
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up database**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## Environment Configuration

### Required Variables

```bash
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://user:pass@host:5432/db
MAILGUN_API_KEY=your_mailgun_key
MAILGUN_DOMAIN=your_mailgun_domain
OPENAI_API_KEY=your_openai_key
FLEXPATH_API_KEY=your_flexpath_key
```

See `.env.example` for complete configuration options.

## API Documentation

### Core Endpoints

- `GET /api/system/health` - System health check
- `GET /api/agents/status` - Agent status and metrics
- `POST /api/leads/process` - Real-time lead processing
- `POST /api/email-campaigns/bulk-send` - Bulk email campaigns
- `POST /api/webhook/dealer-leads` - Dealer webhook integration

### Data Ingestion APIs

1. **Bulk Dataset Processing**
   ```bash
   POST /api/email-campaigns/bulk-send
   Content-Type: application/json
   {
     "csvData": "csv_content_here",
     "campaignName": "Campaign Name",
     "scheduleType": "immediate"
   }
   ```

2. **Real-time Lead Processing**
   ```bash
   POST /api/leads/process
   Content-Type: application/json
   {
     "email": "customer@example.com",
     "phone": "+1234567890",
     "firstName": "John",
     "lastName": "Doe"
   }
   ```

3. **Dealer Webhook Integration**
   ```bash
   POST /api/webhook/dealer-leads
   Content-Type: application/json
   {
     "leadId": "12345",
     "customerData": { ... }
   }
   ```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type checking
- `npm run db:push` - Push database schema

### Code Quality

- **TypeScript**: Full type safety
- **ESLint**: Code linting with custom rules
- **Prettier**: Consistent code formatting
- **Git Hooks**: Pre-commit validation

## Testing

### Test Types

- **Unit Tests**: Component and utility testing
- **Integration Tests**: API and database testing
- **End-to-End Tests**: Full workflow testing

### Running Tests

```bash
npm test                 # Unit tests
npm run test:integration # Integration tests
npm run test:coverage    # Coverage report
```

## Deployment

### CI/CD Pipeline

The project includes comprehensive GitHub Actions workflows:

- **Continuous Integration**: Automated testing and building
- **Code Quality**: Linting, formatting, and security scans
- **Deployment**: Automated staging and production deployments
- **Release Management**: Automated releases with changelogs

### Environments

- **Development**: Local development environment
- **Staging**: `https://ccl-staging.replit.app`
- **Production**: `https://ccl-agents.replit.app`

### Deployment Process

1. **Push to develop**: Triggers staging deployment
2. **Push to main**: Triggers production deployment
3. **Create tag**: Triggers release workflow

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## Monitoring

### Health Checks

- System health monitoring via `/api/system/health`
- Agent status tracking via `/api/agents/status`
- Performance metrics via `/api/system/stats`

### Error Handling

- Comprehensive error logging
- Automated alerting for critical issues
- Graceful degradation strategies

## Security

### Security Features

- Environment variable protection
- API rate limiting
- Input validation and sanitization
- CORS configuration
- SQL injection prevention

### Security Scanning

- Automated dependency vulnerability scans
- CodeQL security analysis
- Regular security audits

## Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Code Standards

- Follow TypeScript best practices
- Maintain test coverage above 80%
- Use conventional commit messages
- Update documentation for new features

## System Requirements

### Minimum Requirements

- Node.js 20.x
- 2GB RAM
- PostgreSQL 13+
- 10GB disk space

### Recommended Requirements

- Node.js 20.x (latest)
- 4GB RAM
- PostgreSQL 15+
- 20GB disk space
- Redis for caching (optional)

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change PORT in .env
2. **Database connection**: Verify DATABASE_URL
3. **API keys**: Check all required environment variables
4. **Build errors**: Clear node_modules and reinstall

### Debug Mode

```bash
NODE_ENV=development DEBUG=* npm run dev
```

### Support

For technical support:
- Check GitHub Issues
- Review deployment logs
- Contact development team

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.