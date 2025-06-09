# Complete Car Loans API Reference

## Authentication

All API endpoints require authentication via the `x-api-key` header:

```bash
curl -H "x-api-key: ccl-internal-2025" https://your-domain.com/api/endpoint
```

## Chat API

### POST /api/chat

Handles real-time customer chat interactions with Cathy AI agent.

**Request:**

```json
{
  "message": "I need help with auto financing",
  "sessionId": "session_123"
}
```

**Response:**

```json
{
  "success": true,
  "response": "Hi there! I'm Cathy from Complete Car Loans...",
  "sessionId": "session_123",
  "timestamp": "2025-06-07T02:30:08.834Z"
}
```

**Response Times:** 1-3 seconds (real OpenAI processing)

## System Monitoring

### GET /api/system/health

Returns comprehensive system health status.

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 136.67,
    "memoryUsage": {
      "heapUsed": 88,
      "heapTotal": 91
    },
    "agents": [
      { "name": "VisitorIdentifierAgent", "status": "active" },
      { "name": "RealtimeChatAgent", "status": "active" },
      { "name": "EmailReengagementAgent", "status": "active" },
      { "name": "LeadPackagingAgent", "status": "active" }
    ],
    "totalLeads": 5,
    "totalActivities": 163,
    "timestamp": "2025-06-07T02:11:49.306Z"
  }
}
```

### GET /api/agents/status

Returns detailed agent status and performance metrics.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "visitor_identifier",
      "name": "VisitorIdentifierAgent",
      "status": "active",
      "processedToday": 42,
      "description": "Identifies and tracks website visitors",
      "icon": "👤",
      "color": "blue"
    }
  ]
}
```

### GET /api/metrics

System performance and usage metrics.

**Response:**

```json
{
  "success": true,
  "data": {
    "leads": 5,
    "activities": 200,
    "agents": 4,
    "uptime": 15000,
    "memory": {
      "heapUsed": 89,
      "heapTotal": 94
    }
  }
}
```

## Lead Management

### GET /api/leads

Retrieve all leads with filtering and pagination.

**Query Parameters:**

- `status`: Filter by lead status (new, contacted, qualified, closed)
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "lead_1_1749239495640",
      "email": "john.test@example.com",
      "status": "new",
      "leadData": {
        "firstName": "John",
        "lastName": "Test",
        "phoneNumber": "(555) 123-4567",
        "vehicleInterest": "SUV",
        "source": "manual_upload"
      },
      "createdAt": "2025-06-06T19:51:35.651Z"
    }
  ]
}
```

### POST /api/leads/process

Process individual lead for re-engagement.

**Request:**

```json
{
  "leadId": "lead_1_1749239495640",
  "action": "email_campaign"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "leadId": "lead_1_1749239495640",
    "processed": true,
    "campaignId": "campaign_123"
  }
}
```

## Email Campaigns

### POST /api/email-campaigns/bulk-send

Send bulk email campaigns to multiple leads.

**Request:**

```json
{
  "campaignName": "re-engagement-may-2025",
  "data": [
    {
      "email": "customer@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "vehicleInterest": "SUV"
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "processed": 1,
    "message": "re-engagement-may-2025 campaign processed 1 records"
  }
}
```

### GET /api/email-campaigns/settings

Retrieve email campaign configuration.

**Response:**

```json
{
  "success": true,
  "data": {
    "fromAddress": "cathy@mail.onerylie.com",
    "domain": "mail.onerylie.com",
    "templatesEnabled": true,
    "dailyLimit": 1000
  }
}
```

## Data Ingestion

### POST /api/webhook/dealer-leads

Webhook endpoint for dealer lead integration.

**Request:**

```json
{
  "email": "customer@dealership.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phoneNumber": "(555) 987-6543",
  "vehicleInterest": "Sedan",
  "dealershipId": "dealer_123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "leadId": "lead_1_1749262000000",
    "status": "qualified",
    "processed": true
  }
}
```

## Activity Logging

### GET /api/activity

Retrieve system activity logs.

**Query Parameters:**

- `limit`: Number of activities (default: 20)
- `type`: Filter by activity type
- `agent`: Filter by agent name

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "activity_123",
      "type": "email_campaign",
      "timestamp": "2025-06-07T02:30:00.000Z",
      "description": "Bulk email queued for customer...",
      "agentType": "EmailReengagementAgent",
      "metadata": {
        "leadId": "lead_1_1749239495640",
        "campaignName": "re-engagement-may-2025"
      }
    }
  ]
}
```

## Error Handling

All API endpoints return standardized error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_001",
    "message": "Campaign name is required",
    "category": "validation",
    "retryable": false
  },
  "timestamp": "2025-06-07T02:12:21.484Z"
}
```

### Error Codes

| Code                 | Category       | Description                            | Retryable |
| -------------------- | -------------- | -------------------------------------- | --------- |
| AUTH_001             | authentication | Unauthorized access - API key required | false     |
| VALIDATION_001       | validation     | Required field missing                 | false     |
| RATE_LIMIT_001       | rate_limit     | Too many requests                      | true      |
| SYSTEM_001           | system         | Internal server error                  | true      |
| BULK_CAMPAIGN_FAILED | processing     | Campaign processing failed             | true      |

## Rate Limits

- Chat API: 60 requests per minute per session
- Email Campaigns: 10 requests per minute
- System Monitoring: 120 requests per minute
- General APIs: 100 requests per minute

## WebSocket API

### Chat WebSocket

Real-time chat connection at `ws://your-domain.com/ws`

**Connection:**

```javascript
const ws = new WebSocket("ws://localhost:5000/ws");
ws.send(
  JSON.stringify({
    type: "message",
    content: "Hello",
    sessionId: "session_123",
  })
);
```

**Message Format:**

```json
{
  "type": "response",
  "content": "Hi there! I'm Cathy...",
  "sessionId": "session_123",
  "timestamp": "2025-06-07T02:30:00.000Z"
}
```

## Testing

### Health Check

```bash
curl -H "x-api-key: ccl-internal-2025" \
  http://localhost:5000/api/system/health
```

### Chat Test

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"message": "hello", "sessionId": "test_123"}' \
  http://localhost:5000/api/chat
```

### Email Campaign Test

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "x-api-key: ccl-internal-2025" \
  -d '{"campaignName": "test", "data": [{"email": "test@example.com"}]}' \
  http://localhost:5000/api/email-campaigns/bulk-send
```
