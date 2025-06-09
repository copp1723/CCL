# Complete Car Loans Agent System - API Integration Guide

## Data Ingestion Methods Overview

Your CCL Agent System supports three reliable data ingestion methods, ranked by
reliability and use case:

### 1. **Bulk Dataset API** (Most Reliable for Large Volumes)

**Endpoint:** `POST /api/email-campaigns/bulk-send` **Best for:** Daily/weekly
dealer data exports, scheduled batch processing **Reliability:** ⭐⭐⭐⭐⭐
(Highest)

```bash
curl -X POST https://your-ccl-domain.com/api/email-campaigns/bulk-send \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "reengagement-001",
    "csvData": [
      {
        "Global Customer ID": "1139508538",
        "Dealer": "Kunes Ford of Antioch",
        "Customer": "John Doe",
        "First Name": "John",
        "Last Name": "Doe",
        "Email": "john.doe@email.com",
        "Lead Source": "Integrity Leads - Full App",
        "Lead Status": "Application Started",
        "City": "Chicago",
        "State": "IL"
      }
    ],
    "messageType": "reengagement",
    "scheduleDelay": 0
  }'
```

**Response:**

```json
{
  "success": true,
  "campaignId": "reengagement-001",
  "scheduled": 3,
  "errors": []
}
```

### 2. **Real-time Lead Processing API** (Best for Live Integration)

**Endpoint:** `POST /api/leads/process` **Best for:** Real-time CRM integration,
immediate lead processing **Reliability:** ⭐⭐⭐⭐ (High)

```bash
curl -X POST https://your-ccl-domain.com/api/leads/process \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@email.com",
    "firstName": "John",
    "lastName": "Doe",
    "dealer": "Your Dealer Name",
    "source": "CCL_CRM_API",
    "status": "Application Started",
    "abandonmentStep": 2,
    "triggerAbandonmentFlow": true
  }'
```

**Response:**

```json
{
  "success": true,
  "visitorId": 123,
  "sessionId": "sess_abc123",
  "message": "Lead processed successfully"
}
```

### 3. **Dealer Webhook Integration** (For Partner Dealers)

**Endpoint:** `POST /api/webhook/dealer-leads` **Best for:** Partner dealer
systems pushing leads automatically **Reliability:** ⭐⭐⭐⭐ (High with proper
authentication)

```bash
curl -X POST https://your-ccl-domain.com/api/webhook/dealer-leads \
  -H "Content-Type: application/json" \
  -d '{
    "dealerKey": "dealer_auth_key_123",
    "leads": [
      {
        "Global Customer ID": "1139508538",
        "Customer": "John Doe",
        "Email": "john.doe@email.com",
        "Dealer": "Partner Dealer Name"
      }
    ]
  }'
```

## Recommended Implementation Strategy

### For CCL Internal Systems:

1. **Primary:** Use Bulk Dataset API for daily data exports
2. **Secondary:** Use Real-time Lead API for immediate processing
3. **Backup:** Manual CSV upload through dashboard

### For Partner Dealers:

1. **Primary:** Webhook integration with authenticated dealer keys
2. **Fallback:** Scheduled bulk data transfer

### Integration Reliability Features:

- Automatic retry logic for failed email sends
- Comprehensive error logging and reporting
- Data validation with detailed error messages
- Idempotent operations (safe to retry)
- Rate limiting protection

### Authentication & Security:

- API key authentication (configured in environment)
- Dealer key validation for webhook endpoints
- Request validation and sanitization
- Comprehensive audit logging

### Current System Status:

- ✅ Mailgun email delivery configured
- ✅ Multi-step campaign automation active
- ✅ Personalized messaging with Cathy personality
- ✅ FlexPath credit check integration ready
- ✅ Real-time processing and scheduling

## API Error Handling

All endpoints return standardized error responses:

```json
{
  "error": "Descriptive error message",
  "code": "ERROR_CODE",
  "details": "Additional context"
}
```

Common HTTP status codes:

- `200`: Success
- `400`: Bad request (validation error)
- `401`: Unauthorized
- `404`: Resource not found
- `500`: Internal server error
