# Onerylie.com Domain Integration - Staging Deployment

## Domain Status: VERIFIED ✅

- **Domain**: onerylie.com
- **Email Provider**: Mailgun
- **MX Records**: Verified ✅
- **DKIM Setup**: In Progress (maio.\_domainkey.mail.onerylie.com)

## Application Configuration

### Environment Variables for Staging

```bash
# Email Configuration - Onerylie.com
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=onerylie.com
MAILGUN_FROM_EMAIL=noreply@onerylie.com

# Application Settings
NODE_ENV=staging
CORS_ORIGIN=https://your-staging-domain.replit.app
```

### New API Endpoints for Domain Integration

#### Domain Verification

- `GET /api/staging/domain-verification` - Verify domain configuration
- `POST /api/staging/test-email-system` - Test email delivery
- `GET /api/staging/deployment-status` - Check staging readiness

#### Enhanced Lead Processing

- `POST /api/staging/process-lead-with-email` - Process leads with welcome
  emails

## Email Templates Configured

### Welcome Email Template

- **Subject**: "Welcome to Complete Car Loans, {firstName}!"
- **From**: noreply@onerylie.com
- **Template**: Professional welcome with next steps

### Follow-up Email Template

- **Subject**: "{firstName}, your auto loan approval is waiting"
- **From**: noreply@onerylie.com
- **Template**: Re-engagement with call-to-action

## DNS Records Required

### Already Verified:

```
Type: MX
Host: mail.onerylie.com
Value: mxa.mailgun.org (Priority 10)
Value: mxb.mailgun.org (Priority 10)

Type: TXT
Host: mail.onerylie.com
Value: v=spf1 include:mailgun.org ~all
```

### Pending Verification:

```
Type: TXT
Host: maio._domainkey.mail.onerylie.com
Value: [DKIM public key from Mailgun]
```

## Staging Deployment Checklist

- ✅ Domain configured in application
- ✅ Email service integration created
- ✅ API endpoints for domain testing
- ✅ Professional email templates
- ✅ Environment configuration ready
- ⏳ DKIM record verification pending
- ⏳ API keys configuration needed

## Next Steps for Complete Setup

1. **Complete DKIM Setup**: Add the remaining TXT record for DKIM signing
2. **Configure API Keys**: Set up Mailgun API key in environment
3. **Test Email Delivery**: Use `/api/staging/test-email-system` endpoint
4. **Deploy to Staging**: Deploy with onerylie.com domain configuration

## Testing Commands

```bash
# Test domain configuration
curl -H "x-api-key: your-api-key" \
  https://your-staging-url/api/staging/domain-verification

# Test email system
curl -X POST -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "test@example.com"}' \
  https://your-staging-url/api/staging/test-email-system

# Process lead with email
curl -X POST -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"email": "customer@example.com", "firstName": "John", "vehicleInterest": "SUV"}' \
  https://your-staging-url/api/staging/process-lead-with-email
```

## Domain Integration Complete ✅

The application is now configured to work with your onerylie.com domain. Email
templates are professional and ready for customer communication. All staging
endpoints are implemented and ready for testing once API keys are configured.
