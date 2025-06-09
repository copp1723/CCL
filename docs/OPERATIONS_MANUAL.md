# Complete Car Loans - Operations Manual

## System Overview

The Complete Car Loans AI Recovery System is a production-ready application that
automatically re-engages customers who abandoned auto loan applications through
intelligent chat conversations and email campaigns.

## Daily Operations

### System Health Monitoring

**Health Check Commands:**

```bash
# System health
curl -H "x-api-key: ccl-internal-2025" \
  https://your-domain.com/api/system/health

# Agent status
curl -H "x-api-key: ccl-internal-2025" \
  https://your-domain.com/api/agents/status

# Performance metrics
curl -H "x-api-key: ccl-internal-2025" \
  https://your-domain.com/api/metrics
```

**Expected Healthy Status:**

- All 4 agents: "active"
- Memory usage: 80-120MB
- Response times: Chat 1-3s, APIs <500ms
- Database connections: Active

### Agent Monitoring

**Active Agents:**

1. **VisitorIdentifierAgent** - Tracks website visitors
2. **RealtimeChatAgent** - Handles chat interactions
3. **EmailReengagementAgent** - Manages email campaigns
4. **LeadPackagingAgent** - Processes lead data

**Performance Indicators:**

- Activities logged: 200+ per day
- Leads processed: 5+ daily
- Chat sessions: Multiple concurrent
- Email delivery: 95%+ success rate

## Chat System Management

### OpenAI Integration

**Response Quality Verification:**

```bash
# Test chat functionality
curl -X POST -H "Content-Type: application/json" \
  -d '{"message": "I have poor credit", "sessionId": "ops_test"}' \
  https://your-domain.com/api/chat
```

**Expected Response Characteristics:**

- Response time: 1-3 seconds (confirms real AI processing)
- Empathetic tone avoiding "bad credit" language
- Guides toward phone number collection
- Professional formatting with line breaks

**Chat Widget Features:**

- Expanded 384px width window
- Proper paragraph formatting
- WebSocket with HTTP fallback
- Real-time typing indicators

### Conversation Quality Standards

**Cathy Agent Personality:**

- Warm and empathetic finance expert
- Specializes in sub-prime auto lending
- Avoids negative credit language
- Guides customers toward soft credit checks
- Never reveals AI nature

**Key Conversation Flows:**

1. Greeting → Credit concern acknowledgment
2. Empathy → Solution-focused responses
3. Trust building → Phone number collection
4. Soft credit check explanation → Pre-approval

## Email Campaign Operations

### Mailgun Configuration

**Domain Setup:** mail.onerylie.com

- SPF Record: Configured
- DKIM: Verified
- Domain verification: Active

**Campaign Management:**

```bash
# Send bulk campaign
curl -X POST -H "Content-Type: application/json" \
  -H "x-api-key: ccl-internal-2025" \
  -d '{
    "campaignName": "monthly-reengagement",
    "data": [
      {"email": "customer@example.com", "firstName": "John"}
    ]
  }' \
  https://your-domain.com/api/email-campaigns/bulk-send
```

**Email Performance Metrics:**

- Delivery rate: 95%+
- Professional sender reputation
- Branded Complete Car Loans messaging
- Comprehensive logging and tracking

### Campaign Templates

**Re-engagement Messages:**

- Personalized greetings with first names
- Credit-positive language
- Clear call-to-action for pre-approval
- Professional Complete Car Loans branding

## Data Management

### Lead Processing

**Data Sources:**

1. Manual upload via admin interface
2. SFTP bulk imports
3. Dealer webhook integrations
4. Chat widget captures

**Lead Validation:**

- Email format verification
- Required field checking
- Duplicate detection
- Schema compliance

**Lead Lifecycle:**

```
new → contacted → qualified → closed
```

### Database Operations

**PostgreSQL Management:**

```bash
# Database health
npm run db:push  # Apply schema changes
npm run db:studio  # Admin interface

# Backup operations
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

**Data Retention:**

- Leads: Indefinite with audit trail
- Activities: 90 days detailed, 1 year summary
- Chat sessions: 30 days
- Email logs: 6 months

## Security Operations

### Authentication Management

**API Key Security:**

- Primary key: `ccl-internal-2025`
- Rotation schedule: Quarterly
- Access logging: Enabled
- Failed attempt monitoring: Active

**Environment Variables:**

```bash
# Core security
OPENAI_API_KEY=sk-...      # Monthly rotation
SESSION_SECRET=...         # Quarterly rotation
FLEXPATH_API_KEY=...       # External service key

# Email security
MAILGUN_API_KEY=...        # Quarterly rotation
MAILGUN_DOMAIN=mail.onerylie.com
```

### Security Monitoring

**Daily Checks:**

- Failed authentication attempts
- Unusual traffic patterns
- Database connection security
- SSL certificate status

## Performance Optimization

### System Metrics

**Target Performance:**

- Chat response: <3 seconds
- API endpoints: <500ms
- Memory usage: <150MB
- CPU utilization: <70%

**Optimization Areas:**

- Database query optimization
- OpenAI response caching
- Static asset delivery
- Connection pooling

### Scaling Considerations

**Current Capacity:**

- Concurrent chat sessions: 50+
- Daily email campaigns: 1000+
- Lead processing: 100+ per hour
- Database connections: 20 pool

## Troubleshooting

### Common Issues

**Chat Not Responding:**

1. Check OpenAI API key validity
2. Verify network connectivity
3. Test fallback HTTP mode
4. Review error logs

**Email Delivery Issues:**

1. Verify Mailgun API key
2. Check domain reputation
3. Validate email addresses
4. Review delivery logs

**Agent Status Errors:**

1. Restart application server
2. Check database connectivity
3. Verify environment variables
4. Review system resources

### Error Resolution

**Database Connection Issues:**

```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1;"

# Restart application
npm run dev
```

**OpenAI API Issues:**

```bash
# Test API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

**Memory Issues:**

```bash
# Monitor memory
ps aux | grep node
free -h

# Restart if needed
pkill -f "tsx server"
npm run dev
```

## Maintenance Schedule

### Daily Tasks

- Monitor system health dashboard
- Review chat conversation quality
- Check email delivery rates
- Verify agent activity logs

### Weekly Tasks

- Analyze lead conversion metrics
- Review error logs and patterns
- Update conversation prompt if needed
- Database performance review

### Monthly Tasks

- Rotate OpenAI API key
- Review and update email templates
- Security audit and penetration testing
- Performance optimization review

### Quarterly Tasks

- Rotate authentication keys
- Comprehensive system backup
- Documentation updates
- Disaster recovery testing

## Emergency Procedures

### System Outage Response

**Immediate Actions:**

1. Check system health endpoint
2. Verify database connectivity
3. Test OpenAI API integration
4. Review recent deployment changes

**Escalation Process:**

1. Restart application server
2. Check infrastructure health
3. Contact hosting provider if needed
4. Implement fallback systems

### Data Backup Recovery

**Backup Verification:**

```bash
# Test backup integrity
pg_restore --list backup_20250607.sql

# Restore if needed
pg_restore -d $DATABASE_URL backup_20250607.sql
```

### Contact Information

**Technical Support:**

- System Administrator: [Contact Info]
- Database Administrator: [Contact Info]
- Security Team: [Contact Info]
- Hosting Provider: [Contact Info]

## Compliance and Reporting

### Data Protection

- Customer data encryption at rest
- Secure API communication (HTTPS)
- Access logging and audit trails
- GDPR compliance measures

### Performance Reporting

- Daily system health reports
- Weekly conversion analytics
- Monthly security audits
- Quarterly performance reviews

This operations manual provides comprehensive guidance for maintaining the
Complete Car Loans AI Recovery System in production.
