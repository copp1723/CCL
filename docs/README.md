
# Complete Car Loans - AI Agent System

A sophisticated multi-agent auto-loan recovery system leveraging advanced AI technologies to optimize customer re-engagement and lead generation through intelligent communication strategies.

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
