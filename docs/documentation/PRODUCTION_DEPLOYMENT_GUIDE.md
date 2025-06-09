# Production Deployment Guide

## Overview

Complete Car Loans agent system is now production-ready with comprehensive
monitoring, security, and environment management features.

## Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] Set NODE_ENV=production
- [ ] Configure DATABASE_URL for production database
- [ ] Generate secure API keys (INTERNAL_API_KEY, JWT_SECRET, SESSION_SECRET)
- [ ] Configure email service credentials (MAILGUN_API_KEY, MAILGUN_DOMAIN)
- [ ] Set OpenAI API key (OPENAI_API_KEY)
- [ ] Configure CORS_ORIGIN for production domain
- [ ] Set TRUST_PROXY=true for production deployments

### 2. Security Requirements

- [ ] Change default INTERNAL_API_KEY from ccl-internal-2025
- [ ] Use strong 256-bit secrets for JWT and session management
- [ ] Configure rate limiting appropriate for expected traffic
- [ ] Set up SSL/TLS termination at load balancer
- [ ] Configure security headers and CORS policies

### 3. Database Preparation

- [ ] Provision production PostgreSQL database
- [ ] Run database migrations: `npm run db:push`
- [ ] Configure connection pooling (recommended: 20 connections)
- [ ] Set up automated backups
- [ ] Configure read replicas if needed

### 4. Monitoring Setup

- [ ] Configure external monitoring service (recommended: DataDog, New Relic)
- [ ] Set up log aggregation
- [ ] Configure alerting for health check failures
- [ ] Set up error tracking
- [ ] Monitor database performance

## Environment Variables

### Required for Production

```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:port/database
INTERNAL_API_KEY=your-secure-api-key
JWT_SECRET=your-256-bit-jwt-secret
SESSION_SECRET=your-256-bit-session-secret
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-mailgun-domain
OPENAI_API_KEY=your-openai-api-key
CORS_ORIGIN=https://your-domain.com
TRUST_PROXY=true
```

### Optional Configuration

```bash
PORT=5000
DB_POOL_SIZE=20
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=warn
METRICS_ENABLED=true
```

## Deployment Process

### 1. Build Application

```bash
npm ci --production
npm run build
```

### 2. Database Migration

```bash
npm run db:push
```

### 3. Start Production Server

```bash
NODE_ENV=production npm start
```

## Health Check Endpoints

### Primary Health Check

- **URL**: `/health` or `/api/monitoring/health`
- **Method**: GET
- **Response**: Comprehensive system health status
- **Use**: Load balancer health checks

### Kubernetes Probes

- **Readiness**: `/ready` or `/api/monitoring/ready`
- **Liveness**: `/live` or `/api/monitoring/live`
- **Response**: Service readiness for traffic routing

### Production Readiness

- **URL**: `/api/monitoring/production-readiness`
- **Method**: GET
- **Response**: Validation of production configuration

## Monitoring Endpoints

### System Metrics

- **URL**: `/api/monitoring/metrics`
- **Authentication**: Required
- **Response**: Application and system metrics

### Performance Metrics

- **URL**: `/api/monitoring/performance`
- **Authentication**: Required
- **Response**: Request performance and error rates

### Prometheus Export

- **URL**: `/api/monitoring/metrics/prometheus`
- **Authentication**: Required
- **Response**: Metrics in Prometheus format

## Security Features

### Implemented Security Measures

- Rate limiting (100 requests/minute by default)
- Input sanitization and validation
- Security headers (HSTS, CSP, XSS protection)
- Request logging and audit trail
- Error handling without information disclosure
- API key authentication for all endpoints

### Security Headers

- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000
- Referrer-Policy: strict-origin-when-cross-origin

## Performance Optimization

### Database Configuration

- Connection pooling: 20 connections (adjustable)
- Idle timeout: 30 seconds
- Connection timeout: 60 seconds
- Query optimization enabled

### Application Configuration

- Request body size limit: 10MB
- JSON payload validation
- Response compression (if enabled by reverse proxy)
- Static asset caching

## Load Balancer Configuration

### Recommended Settings

```nginx
upstream ccl_backend {
    server app1:5000 max_fails=3 fail_timeout=30s;
    server app2:5000 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Health check
    location /health {
        proxy_pass http://ccl_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API routes
    location /api/ {
        proxy_pass http://ccl_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## Backup and Recovery

### Database Backup

```bash
# Daily automated backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Point-in-time recovery setup
# Configure WAL archiving on PostgreSQL
```

### Application Data

- Email campaign logs
- Agent activity history
- Lead processing records
- System metrics history

## Troubleshooting

### Common Issues

#### High Memory Usage

- Monitor `/api/monitoring/metrics` for memory consumption
- Check for memory leaks in long-running processes
- Restart application if memory usage exceeds 80%

#### Database Connection Issues

- Verify DATABASE_URL configuration
- Check connection pool settings
- Monitor active connections vs pool size

#### Email Delivery Failures

- Verify Mailgun credentials
- Check domain DNS configuration
- Monitor bounce rates and delivery status

#### Authentication Failures

- Verify API key configuration
- Check request headers format
- Review rate limiting settings

### Emergency Procedures

#### Service Restart

```bash
# Graceful restart
kill -TERM $(pgrep -f "npm start")
NODE_ENV=production npm start

# Force restart if needed
kill -KILL $(pgrep -f "npm start")
NODE_ENV=production npm start
```

#### Database Recovery

```bash
# Restore from backup
psql $DATABASE_URL < backup_20250605.sql

# Run migrations if schema changes
npm run db:push
```

## Scaling Considerations

### Horizontal Scaling

- Deploy multiple application instances
- Use external session store (Redis)
- Implement sticky sessions if needed
- Scale database with read replicas

### Vertical Scaling

- Monitor CPU and memory usage
- Adjust NODE_OPTIONS for heap size
- Optimize database queries
- Enable application profiling

## Maintenance

### Regular Tasks

- [ ] Weekly security updates
- [ ] Monthly dependency updates
- [ ] Quarterly performance reviews
- [ ] Database maintenance and optimization
- [ ] Log rotation and cleanup
- [ ] SSL certificate renewal

### Monitoring Alerts

- System health check failures
- High error rates (>5%)
- Slow response times (>2 seconds)
- Database connection failures
- Memory usage above 80%
- Disk space below 20%

## Support and Documentation

### API Documentation

- Health checks: Available at monitoring endpoints
- Authentication: API key required for all non-health endpoints
- Rate limiting: 100 requests per minute per IP
- Error codes: Standardized JSON error responses

### System Status

- Health: `/api/monitoring/health`
- Configuration: `/api/monitoring/config`
- Performance: `/api/monitoring/performance`
- Production readiness: `/api/monitoring/production-readiness`

Production deployment is ready with comprehensive monitoring, security, and
operational features.
