
# Complete Car Loans - AI Agent System

> A sophisticated multi-agent auto-loan recovery system leveraging advanced AI technologies.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp config/environments/.env.example .env
# Edit .env with your API keys

# Start development server
npm run dev
```

**Access Points:**
- Frontend: http://localhost:24678
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

## 📋 System Status

✅ **Production Ready** - Enterprise-grade security and monitoring  
✅ **AI Agents Active** - Visitor tracking, chat, and email automation  
✅ **Secure API** - Authentication, rate limiting, and audit logging  
✅ **Real-time Dashboard** - Live metrics and system monitoring  

## 📁 Project Structure

```
├── client/                 # React frontend application
├── server/                 # Node.js backend with AI agents
├── shared/                 # Shared types and schemas
├── docs/                   # Comprehensive documentation
├── config/                 # Environment and configuration
├── scripts/                # Build and deployment scripts
├── tests/                  # Automated test suite
└── archive/                # Archived/disabled components
```

## 🤖 AI Agents

1. **Visitor Identifier** - Tracks and identifies website visitors
2. **Realtime Chat** - Handles customer conversations with "Cathy"
3. **Lead Packaging** - Processes and packages qualified leads
4. **Email Reengagement** - Automated email campaigns and follow-ups

## 📖 Documentation

- **[Installation Guide](./docs/INSTALLATION.md)** - Setup and configuration
- **[Development Guide](./docs/DEVELOPMENT.md)** - Development workflow
- **[API Integration](./docs/API_INTEGRATION_GUIDE.md)** - API usage and endpoints
- **[Deployment Guide](./docs/PRODUCTION_DEPLOYMENT_GUIDE.md)** - Production deployment
- **[Security Documentation](./docs/security/)** - Security implementation

## 🔧 Development

```bash
# Development server
npm run dev

# Code quality
npm run check      # TypeScript validation
npm run lint       # Code linting
npm run format     # Code formatting

# Testing
npm test           # Run test suite
```

## 🌐 Deployment

The system is configured for deployment on Replit with:
- Automatic scaling and load balancing
- Production-grade security controls
- Real-time monitoring and alerting
- Comprehensive health checks

See [Deployment Documentation](./docs/deployment/) for detailed instructions.

## 🔒 Security Features

- JWT-based authentication
- API rate limiting and abuse protection
- Input validation and sanitization
- Comprehensive audit logging
- Real-time threat detection
- Enterprise-grade compliance controls

## 📊 System Requirements

**Minimum:**
- Node.js 20.x
- 2GB RAM
- PostgreSQL 13+ (optional)

**Recommended:**
- Node.js 20.x (latest)
- 4GB RAM
- PostgreSQL 15+
- Redis for caching

## 🆘 Support

- **Documentation**: [./docs/](./docs/)
- **API Reference**: [./docs/api/](./docs/api/)
- **Troubleshooting**: [./docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)

---

**Status**: Production Ready ✅  
**Last Updated**: June 2025  
**Version**: 1.0.0
