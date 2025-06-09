# Complete Car Loans - Technical Architecture

## System Architecture Overview

The Complete Car Loans AI Recovery System implements a microservice-inspired
architecture with intelligent agent orchestration, real-time communication, and
robust data processing capabilities.

## Core Architecture Components

### Frontend Layer (React + TypeScript)

```
┌─────────────────────────────────────────┐
│             Client Layer                │
├─────────────────────────────────────────┤
│ • React 18 with TypeScript              │
│ • Tailwind CSS for styling              │
│ • Tanstack Query for state management   │
│ • Wouter for routing                    │
│ • Real-time WebSocket connections       │
└─────────────────────────────────────────┘
```

**Key Components:**

- **Admin Dashboard**: Real-time monitoring with live metrics
- **Chat Widget**: Expandable interface with proper formatting
- **Data Ingestion Forms**: Multi-format upload handling
- **Lead Management**: CRUD operations with filtering

### Backend Layer (Node.js + Express)

```
┌─────────────────────────────────────────┐
│           Application Server            │
├─────────────────────────────────────────┤
│ • Express.js RESTful APIs               │
│ • TypeScript for type safety            │
│ • WebSocket server for real-time chat   │
│ • Multi-agent orchestration system      │
│ • Authentication middleware             │
└─────────────────────────────────────────┘
```

**API Architecture:**

- RESTful endpoints with standardized responses
- WebSocket integration for real-time features
- Comprehensive error handling and validation
- API key authentication with rate limiting

### Data Layer (PostgreSQL + Drizzle)

```
┌─────────────────────────────────────────┐
│             Data Storage                │
├─────────────────────────────────────────┤
│ • PostgreSQL for relational data        │
│ • Drizzle ORM for type-safe queries     │
│ • Connection pooling for performance    │
│ • Automated schema migrations           │
└─────────────────────────────────────────┘
```

## Multi-Agent System Architecture

### Agent Orchestration

```
┌─────────────────┐    ┌─────────────────┐
│ Visitor         │    │ Realtime        │
│ Identifier      │◄──►│ Chat            │
│ Agent           │    │ Agent           │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Lead            │    │ Email           │
│ Packaging       │◄──►│ Reengagement    │
│ Agent           │    │ Agent           │
└─────────────────┘    └─────────────────┘
```

**Agent Responsibilities:**

1. **VisitorIdentifierAgent**

   - Tracks website visitor behavior
   - Identifies potential leads
   - Triggers engagement workflows

2. **RealtimeChatAgent**

   - Manages chat widget interactions
   - Integrates with OpenAI for responses
   - Handles session management

3. **EmailReengagementAgent**

   - Processes bulk email campaigns
   - Manages Mailgun integration
   - Tracks delivery and engagement

4. **LeadPackagingAgent**
   - Formats lead data for processing
   - Validates data integrity
   - Manages lead lifecycle states

### Inter-Agent Communication

```typescript
interface AgentMessage {
  agentId: string;
  type: "lead_identified" | "chat_session" | "email_sent";
  payload: any;
  timestamp: Date;
}
```

## OpenAI Integration Architecture

### Enhanced Conversational AI

```
┌─────────────────────────────────────────┐
│            OpenAI Integration           │
├─────────────────────────────────────────┤
│ • GPT-4 model for conversations         │
│ • Enhanced system prompts              │
│ • Empathetic sub-prime lending focus   │
│ • Fallback response system             │
│ • Response time optimization           │
└─────────────────────────────────────────┘
```

**Conversation Flow:**

1. User message received via WebSocket/HTTP
2. Enhanced system prompt applied
3. OpenAI GPT-4 processing (1-3 seconds)
4. Response formatting with line breaks
5. Fallback to contextual responses if needed

**System Prompt Architecture:**

- Role-based personality (Cathy, finance expert)
- Conversational style guidelines
- Empathy-first approach
- Phone number collection guidance
- Credit-positive language enforcement

## Email Delivery Architecture

### Mailgun Integration

```
┌─────────────────────────────────────────┐
│          Email Infrastructure           │
├─────────────────────────────────────────┤
│ • Mailgun API integration               │
│ • onerylie.com domain verification     │
│ • SPF/DKIM authentication              │
│ • Delivery tracking and logging        │
│ • Template management system           │
└─────────────────────────────────────────┘
```

**Email Processing Pipeline:**

1. Campaign creation with lead data
2. Template population and personalization
3. Mailgun API submission
4. Delivery status tracking
5. Engagement metrics collection

## Data Processing Architecture

### Lead Ingestion Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Manual      │    │ Data        │    │ Lead        │
│ Upload      │───►│ Validation  │───►│ Storage     │
└─────────────┘    └─────────────┘    └─────────────┘
┌─────────────┐              │                │
│ SFTP        │──────────────┤                │
│ Import      │              │                ▼
└─────────────┘              │    ┌─────────────┐
┌─────────────┐              │    │ Agent       │
│ Webhook     │──────────────┘    │ Processing  │
│ Integration │                   └─────────────┘
└─────────────┘
```

**Validation Schema:**

```typescript
interface LeadData {
  email: string; // Required, validated format
  firstName?: string; // Optional
  lastName?: string; // Optional
  phoneNumber?: string; // Optional, formatted
  vehicleInterest?: string; // Optional
  source: string; // Required, tracked
}
```

## Security Architecture

### Authentication & Authorization

```
┌─────────────────────────────────────────┐
│            Security Layer               │
├─────────────────────────────────────────┤
│ • API key authentication               │
│ • Request validation middleware        │
│ • Rate limiting per endpoint           │
│ • Input sanitization                   │
│ • HTTPS enforcement                    │
└─────────────────────────────────────────┘
```

**Security Implementation:**

- API key rotation quarterly
- Environment variable protection
- SQL injection prevention
- XSS protection headers
- CORS configuration

### Data Protection

- Encryption at rest (PostgreSQL)
- Encryption in transit (HTTPS/WSS)
- Sensitive data masking in logs
- Access audit trails
- Session security

## Performance Architecture

### Optimization Strategies

```
┌─────────────────────────────────────────┐
│         Performance Layer               │
├─────────────────────────────────────────┤
│ • Connection pooling (PostgreSQL)      │
│ • OpenAI response caching              │
│ • Static asset optimization            │
│ • Database query optimization          │
│ • Memory management                    │
└─────────────────────────────────────────┘
```

**Performance Metrics:**

- Chat response time: 1-3 seconds
- API response time: <500ms
- Memory usage: ~90MB stable
- Database connections: 20 pool
- Concurrent users: 50+ supported

## Real-time Communication

### WebSocket Architecture

```typescript
interface ChatWebSocket extends WebSocket {
  sessionId?: string;
  isAlive?: boolean;
}

class ChatWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ChatWebSocket>;

  // Heartbeat monitoring
  private startHeartbeat(): void;

  // Message routing
  private handleMessage(ws: ChatWebSocket, message: any): Promise<void>;

  // Session management
  public sendToSession(sessionId: string, message: any): void;
}
```

**WebSocket Features:**

- Automatic reconnection
- HTTP fallback for reliability
- Session-based message routing
- Heartbeat monitoring
- Graceful degradation

## Database Schema Architecture

### Core Tables

```sql
-- User sessions for chat
CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);

-- Lead management
CREATE TABLE system_leads (
  id VARCHAR PRIMARY KEY,
  email VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  lead_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity logging
CREATE TABLE system_activities (
  id VARCHAR PRIMARY KEY,
  type VARCHAR NOT NULL,
  description TEXT,
  agent_type VARCHAR,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent status tracking
CREATE TABLE system_agents (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  status VARCHAR DEFAULT 'active',
  processed_today INTEGER DEFAULT 0,
  metadata JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Deployment Architecture

### Environment Configuration

```
┌─────────────────────────────────────────┐
│         Deployment Strategy             │
├─────────────────────────────────────────┤
│ • Replit hosting platform              │
│ • PostgreSQL database service          │
│ • Environment variable management      │
│ • Automated build and deployment       │
│ • Health monitoring and alerts         │
└─────────────────────────────────────────┘
```

**Build Process:**

1. TypeScript compilation
2. Frontend asset bundling with Vite
3. Backend bundling with esbuild
4. Environment validation
5. Database migration application

## Monitoring & Observability

### System Monitoring

```typescript
interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  agents: AgentStatus[];
  totalLeads: number;
  totalActivities: number;
}
```

**Monitoring Components:**

- Real-time health endpoints
- Agent status tracking
- Performance metrics collection
- Error rate monitoring
- Resource utilization tracking

## Scalability Considerations

### Horizontal Scaling

- Stateless application design
- Database connection pooling
- Load balancer compatibility
- Session storage externalization

### Vertical Scaling

- Memory optimization
- CPU usage monitoring
- Database query optimization
- Cache implementation strategies

## Future Architecture Enhancements

### Planned Improvements

1. **Microservice Decomposition**

   - Separate chat service
   - Dedicated email service
   - Agent orchestration service

2. **Advanced Analytics**

   - Conversation quality metrics
   - Lead conversion tracking
   - A/B testing framework

3. **Enhanced Security**
   - OAuth2 integration
   - Multi-factor authentication
   - Advanced threat detection

This technical architecture provides a comprehensive foundation for the Complete
Car Loans AI Recovery System, ensuring scalability, maintainability, and robust
performance in production environments.
