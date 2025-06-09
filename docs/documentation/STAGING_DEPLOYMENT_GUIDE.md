# Staging Deployment Guide

## Overview

This guide covers the deployment process for the Complete Car Loans (CCL) Agent
System to staging environment on Replit.

## Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] Verify `.env.staging` contains all required variables
- [ ] Update `INTERNAL_API_KEY` for staging security
- [ ] Configure database connection string
- [ ] Set up monitoring endpoints

### 2. Code Quality Verification

- [ ] Run `npm run check` for TypeScript validation
- [ ] Execute `npm run audit` for security vulnerabilities
- [ ] Verify all tests pass (when implemented)
- [ ] Review error handling and logging

### 3. Security Validation

- [ ] API authentication working correctly
- [ ] Input sanitization functional
- [ ] Rate limiting configured
- [ ] Security headers implemented

## Deployment Steps

### 1. Environment Setup

```bash
# Copy staging environment configuration
cp .env.staging .env

# Install dependencies
npm install

# Run security audit
npm run audit

# Verify TypeScript compilation
npm run check
```

### 2. Database Setup

```bash
# Run database migrations if needed
npm run db:push

# Verify database connectivity
curl -H "x-api-key: ccl-staging-2025" http://0.0.0.0:5000/api/system/health
```

### 3. Application Deployment

```bash
# Start application
npm run dev
```

### 4. Health Verification

```bash
# Test health endpoint
curl http://0.0.0.0:5000/health

# Test authenticated endpoint
curl -H "x-api-key: ccl-staging-2025" http://0.0.0.0:5000/api/system/health

# Verify agent status
curl -H "x-api-key: ccl-staging-2025" http://0.0.0.0:5000/api/agents/status
```

## Monitoring & Observability

### Key Metrics to Monitor

- Response times (target: <200ms for API endpoints)
- Memory usage (alert at >85%)
- Error rates (target: <1%)
- API authentication failures

### Health Check Endpoints

- `/health` - Basic health status (public)
- `/api/system/health` - Detailed system health (authenticated)
- `/api/agents/status` - Agent system status
- `/api/monitoring/metrics` - Performance metrics

## Troubleshooting

### Common Issues

#### Authentication Failures

- Verify API key in request headers
- Check environment variable configuration
- Review rate limiting settings

#### Database Connection Issues

- Verify DATABASE_URL configuration
- Check network connectivity
- Review connection pool settings

#### Performance Issues

- Monitor memory usage via `/api/monitoring/metrics`
- Check for slow queries in logs
- Review cache hit rates

### Emergency Procedures

```bash
# Restart application
kill -TERM $(pgrep -f "npm run dev")
npm run dev

# Check system resources
free -h
df -h
```

## Staging Environment Specifications

### Resource Requirements

- Memory: 512MB minimum, 1GB recommended
- CPU: 1 core minimum
- Storage: 1GB minimum
- Network: Standard Replit networking

### Environment Variables

```
NODE_ENV=staging
PORT=5000
INTERNAL_API_KEY=ccl-staging-2025
DATABASE_URL=postgresql://...
RATE_LIMIT_MAX_REQUESTS=200
RATE_LIMIT_WINDOW_MS=60000
```

## Post-Deployment Validation

### Functional Testing

1. **Authentication**: Verify API key authentication
2. **Lead Processing**: Test lead creation and processing
3. **Agent Status**: Confirm all agents are operational
4. **Email Campaigns**: Validate campaign processing
5. **Error Handling**: Test error scenarios

### Performance Testing

1. **Load Testing**: Simulate concurrent users
2. **Stress Testing**: Test system limits
3. **Memory Testing**: Monitor for memory leaks
4. **Response Time**: Verify sub-200ms responses

## Success Criteria

- [ ] All health checks passing
- [ ] API authentication functional
- [ ] Agent system operational
- [ ] Error handling working correctly
- [ ] Performance metrics within targets
- [ ] Security controls active
- [ ] Monitoring and logging functional

## Next Steps

1. Run staging validation tests
2. Conduct user acceptance testing
3. Performance benchmarking
4. Security penetration testing
5. Production deployment preparation

## Support Contacts

- Technical Lead: [Contact Information]
- DevOps Team: [Contact Information]
- Security Team: [Contact Information]
