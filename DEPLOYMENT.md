# Deployment Guide - Complete Car Loans Agent System

## Overview

This document outlines the CI/CD pipeline and deployment process for the Complete Car Loans multi-agent system.

## CI/CD Pipeline Architecture

### GitHub Actions Workflows

1. **Main CI/CD Pipeline** (`.github/workflows/ci.yml`)
   - Triggers on push to `main` and `develop` branches
   - Runs type checking, linting, and builds
   - Uploads build artifacts
   - Performs security audits

2. **Test Suite** (`.github/workflows/test.yml`)
   - Unit tests with coverage reporting
   - Integration tests with PostgreSQL
   - End-to-end tests with Playwright

3. **Code Quality & Security** (`.github/workflows/quality.yml`)
   - ESLint code analysis
   - Prettier formatting checks
   - Security vulnerability scanning
   - Bundle size analysis

4. **Deployment Pipeline** (`.github/workflows/deploy.yml`)
   - Automated staging deployments from `develop`
   - Production deployments from `main`
   - Health checks and rollback procedures

5. **Release Management** (`.github/workflows/release.yml`)
   - Automated release creation
   - Changelog generation
   - Release artifact building

## Environment Configuration

### Required Environment Variables

```bash
# Core Application
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Email Service (Mailgun)
MAILGUN_API_KEY=key-xxxxx
MAILGUN_DOMAIN=mg.yourdomain.com

# AI Services
OPENAI_API_KEY=sk-xxxxx

# Credit Check Service
FLEXPATH_API_KEY=xxxxx

# Security
SESSION_SECRET=xxxxx
JWT_SECRET=xxxxx
```

### Environment Setup

1. **Development**
   ```bash
   cp .env.example .env.development
   # Edit .env.development with development values
   ```

2. **Staging**
   ```bash
   cp .env.example .env.staging
   # Edit .env.staging with staging values
   ```

3. **Production**
   ```bash
   cp .env.example .env.production
   # Edit .env.production with production values
   ```

## Deployment Process

### Automatic Deployments

1. **Staging Deployment**
   - Push to `develop` branch
   - CI/CD pipeline runs automatically
   - Deploys to staging environment on success

2. **Production Deployment**
   - Push to `main` branch
   - Full test suite and security scans
   - Deploys to production on success

### Manual Deployment

1. **Build Application**
   ```bash
   npm run ci:build
   ```

2. **Run Tests**
   ```bash
   npm run ci:test
   ```

3. **Deploy to Environment**
   ```bash
   # Staging
   npm run deploy:staging
   
   # Production
   npm run deploy:production
   ```

## Health Checks

### Automated Monitoring

- **Health Endpoint**: `/api/system/health`
- **Agent Status**: `/api/agents/status`
- **System Stats**: `/api/system/stats`

### Post-Deployment Verification

```bash
# Check application health
curl -f https://your-domain.com/api/system/health

# Verify agent status
curl -f https://your-domain.com/api/agents/status

# Check system metrics
curl -f https://your-domain.com/api/system/stats
```

## Rollback Procedures

### Automatic Rollback

- Triggered on deployment failure
- Health check failures
- Critical errors detected

### Manual Rollback

1. **Identify Last Good Deployment**
   ```bash
   git tag --list "deploy-*" | tail -5
   ```

2. **Rollback to Previous Version**
   ```bash
   git checkout <previous-tag>
   npm run deploy:production
   ```

## Security Considerations

### Secret Management

- All secrets stored in GitHub Secrets
- Environment-specific configurations
- Rotation procedures documented

### Access Control

- Branch protection on `main` and `develop`
- Required reviews for pull requests
- Deployment approvals for production

## Monitoring & Alerts

### Application Monitoring

- Real-time health checks
- Performance metrics tracking
- Error rate monitoring

### Alert Channels

- GitHub Actions status notifications
- Email alerts for critical failures
- Slack integration for deployment status

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check TypeScript errors
   - Verify dependency versions
   - Review environment variables

2. **Deployment Failures**
   - Check health endpoints
   - Review application logs
   - Verify network connectivity

3. **Test Failures**
   - Review test outputs
   - Check environment setup
   - Verify external service connectivity

### Debug Commands

```bash
# Check application status
npm run health-check

# Review build output
npm run build 2>&1 | tee build.log

# Test connectivity
curl -v https://your-domain.com/api/system/health
```

## Performance Optimization

### Build Optimization

- Tree shaking enabled
- Code splitting implemented
- Asset compression configured

### Runtime Optimization

- Connection pooling for database
- Caching strategies implemented
- Load balancing ready

## Maintenance

### Regular Tasks

- Weekly security scans
- Monthly dependency updates
- Quarterly performance reviews

### Update Procedures

1. **Dependency Updates**
   ```bash
   npm audit
   npm update
   npm test
   ```

2. **Security Patches**
   ```bash
   npm audit fix
   npm run ci:test
   ```

## Support

For deployment issues:
1. Check GitHub Actions logs
2. Review application health endpoints
3. Contact development team with specific error details