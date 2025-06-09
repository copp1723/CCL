# Staging Deployment Checklist

## Pre-Deployment Requirements

### ✅ Environment Setup

- [ ] Copy `.env.staging` to `.env`
- [ ] Configure `OPENAI_API_KEY` (required for agents)
- [ ] Set `DATABASE_URL` if using external database
- [ ] Update `INTERNAL_API_KEY` for security

### ✅ Code Quality

- [ ] Run `npm run check` (TypeScript validation)
- [ ] Run `npm run audit` (security check)
- [ ] Verify no eslint errors
- [ ] Remove any debug console.logs

### ✅ Security Validation

- [ ] API authentication working
- [ ] Rate limiting functional
- [ ] Input sanitization active
- [ ] Security headers implemented

## Deployment Steps

### 1. Prepare Environment

```bash
cp .env.staging .env
npm install
npm run check
npm run audit
```

### 2. Start Application

```bash
npm run dev
```

### 3. Verify Health

```bash
# Basic health check
curl http://0.0.0.0:5000/health

# Authenticated health check
curl -H "x-api-key: ccl-staging-2025" http://0.0.0.0:5000/api/system/health
```

### 4. Test Core Functionality

```bash
# Test agent status
curl -H "x-api-key: ccl-staging-2025" http://0.0.0.0:5000/api/agents/status

# Test metrics
curl -H "x-api-key: ccl-staging-2025" http://0.0.0.0:5000/api/monitoring/metrics
```

## Post-Deployment Validation

### ✅ Functional Tests

- [ ] Health endpoints responding
- [ ] API authentication working
- [ ] Agent system operational
- [ ] Error handling functional
- [ ] Performance metrics available

### ✅ Performance Tests

- [ ] Response times <200ms
- [ ] Memory usage <500MB
- [ ] No memory leaks detected
- [ ] Cache hit rates >80%

### ✅ Security Tests

- [ ] Unauthorized requests blocked
- [ ] Rate limiting working
- [ ] Input validation active
- [ ] Security headers present

## Success Criteria

- ✅ All health checks passing
- ✅ API endpoints functional
- ✅ Security controls active
- ✅ Performance within targets
- ✅ Error handling working
- ✅ Monitoring operational

## Rollback Plan

If issues occur:

1. Stop current deployment
2. Review logs for errors
3. Fix configuration issues
4. Redeploy with corrections

## Production Readiness

After successful staging deployment:

- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Team training completed

Ready for production deployment ✅
