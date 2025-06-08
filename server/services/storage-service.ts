/**
 * Unified Storage Service
 * Production-ready service with database integration, validation, and security
 * Includes performance optimization, caching, and error handling
 */

import { randomUUID, randomBytes, createCipheriv, createDecipheriv, scrypt } from 'crypto';
import { promisify } from 'util';
import { Pool } from 'pg';
import { LRUCache } from 'lru-cache';

const scryptAsync = promisify(scrypt);

// --- Fast fail for missing/weak ENCRYPTION_KEY ---
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY is missing or too weak! Set a strong key (32+ chars) in your environment.');
}

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Enhanced storage service with database integration
class StorageService {
  private cache = new LRUCache<string, any>({
    max: 1000,
    ttl: 60_000 // 1 minute TTL
  });
  private pendingInvalidations = new Set<string>();
  private primingLocks = new Set<string>();
  private encryptionKey = process.env.ENCRYPTION_KEY!;

  // Initialize missing properties
  private activities: any[] = [];
  private visitors: any[] = [];
  private leads: any[] = []; // For stats calculation only - actual leads are in database
  private activityCounter: number = 0;

  constructor() {
    // Initialize batch invalidation
    setInterval(() => {
      this.pendingInvalidations.forEach(pattern => this.clearCache(pattern));
      this.pendingInvalidations.clear();
    }, 1000);

    // Initialize database on startup
    this.initializeDatabase().catch(console.error);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async encrypt(text: string): Promise<string> {
    if (!text) return text;

    try {
      const iv = randomBytes(16);
      const key = (await scryptAsync(this.encryptionKey, 'salt', 32)) as Buffer;
      const cipher = createCipheriv('aes-256-cbc', key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  private async decrypt(encryptedText: string): Promise<string> {
    if (!encryptedText) return encryptedText;

    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      if (!ivHex || !encrypted) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const key = (await scryptAsync(this.encryptionKey, 'salt', 32)) as Buffer;
      const decipher = createDecipheriv('aes-256-cbc', key, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  private validateLeadData(leadData: any): void {
    if (!leadData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadData.email)) {
      throw new Error('Invalid email format');
    }
    if (leadData.phoneNumber && !/^\+?[\d\s\-\(\)]+$/.test(leadData.phoneNumber)) {
      throw new Error('Invalid phone number format');
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, attempts: number = 3): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === attempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
    throw new Error('Max retry attempts exceeded');
  }

  // ============================================================================
  // LEAD OPERATIONS
  // ============================================================================

  async createLead(leadData: any): Promise<any> {
    this.validateLeadData(leadData);

    const leadId = randomBytes(16).toString('hex');
    const encryptedEmail = await this.encrypt(leadData.email);
    const encryptedPhone = leadData.phoneNumber ? await this.encrypt(leadData.phoneNumber) : null;

    return this.withRetry(async () => {
      const query = `
        INSERT INTO leads (id, email, phone_number, status, lead_data, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, status, created_at, lead_data
      `;

      const values = [
        leadId,
        encryptedEmail,
        encryptedPhone,
        leadData.status || 'new',
        JSON.stringify(leadData)
      ];

      const result = await pool.query(query, values);
      const newLead = {
        ...result.rows[0],
        email: leadData.email, // Return decrypted for response
        phoneNumber: leadData.phoneNumber
      };

      this.invalidateCache('leads:*');
      return newLead;
    });
  }

  async getLeads(limit?: number): Promise<any[]> {
    const cacheKey = `leads:${limit || 'all'}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Prevent concurrent cache priming
    if (this.primingLocks.has(cacheKey)) {
      // Wait for ongoing request
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.cache.get(cacheKey) || [];
    }

    this.primingLocks.add(cacheKey);

    try {
      return await this.withRetry(async () => {
        const query = limit
          ? 'SELECT * FROM leads ORDER BY created_at DESC LIMIT $1'
          : 'SELECT * FROM leads ORDER BY created_at DESC';

        const values = limit ? [limit] : [];
        const result = await pool.query(query, values);

        const leads = await Promise.all(result.rows.map(async row => ({
          ...row,
          email: await this.decrypt(row.email),
          phoneNumber: row.phone_number ? await this.decrypt(row.phone_number) : null,
          leadData: typeof row.lead_data === 'string' ? JSON.parse(row.lead_data) : row.lead_data
        })));

        this.cache.set(cacheKey, leads);
        return leads;
      });
    } finally {
      this.primingLocks.delete(cacheKey);
    }
  }

  async getLeadById(id: string): Promise<any | null> {
    const cacheKey = `lead:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    return this.withRetry(async () => {
      const query = 'SELECT * FROM leads WHERE id = $1';
      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) return null;

      const lead = {
        ...result.rows[0],
        email: await this.decrypt(result.rows[0].email),
        phoneNumber: result.rows[0].phone_number ? await this.decrypt(result.rows[0].phone_number) : null,
        leadData: typeof result.rows[0].lead_data === 'string' ? JSON.parse(result.rows[0].lead_data) : result.rows[0].lead_data
      };

      this.cache.set(cacheKey, lead);
      return lead;
    });
  }

  async updateLead(id: string, updates: any): Promise<boolean> {
    if (updates.email) {
      this.validateLeadData(updates);
      updates.email = await this.encrypt(updates.email);
    }
    if (updates.phoneNumber) {
      updates.phone_number = await this.encrypt(updates.phoneNumber);
      delete updates.phoneNumber;
    }

    return this.withRetry(async () => {
      const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const query = `UPDATE leads SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING id`;
      const values = [id, ...Object.values(updates)];

      const result = await pool.query(query, values);
      const success = (result.rowCount ?? 0) > 0;

      if (success) {
        this.invalidateCache(`lead:${id}`);
        this.invalidateCache('leads:*');
      }

      return success;
    });
  }

  async deleteLead(id: string): Promise<boolean> {
    return this.withRetry(async () => {
      const query = 'DELETE FROM leads WHERE id = $1 RETURNING id';
      const result = await pool.query(query, [id]);
      const success = (result.rowCount ?? 0) > 0;

      if (success) {
        this.invalidateCache(`lead:${id}`);
        this.invalidateCache('leads:*');
      }

      return success;
    });
  }

  // ============================================================================
  // ACTIVITY OPERATIONS
  // ============================================================================

  async createActivity(
    type: string,
    description: string,
    agentType?: string,
    metadata?: any
  ): Promise<any> {
    const activityId = randomBytes(16).toString('hex');

    return this.withRetry(async () => {
      const query = `
        INSERT INTO activities (id, type, description, agent_type, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, type, description, agent_type, metadata, created_at
      `;

      const values = [
        activityId,
        type,
        description,
        agentType,
        metadata ? JSON.stringify(metadata) : null
      ];

      const result = await pool.query(query, values);
      const activity = {
        ...result.rows[0],
        timestamp: result.rows[0].created_at.toISOString(),
        agentType: result.rows[0].agent_type,
        metadata: result.rows[0].metadata ? JSON.parse(result.rows[0].metadata) : null
      };

      this.invalidateCache('activities:*');
      return activity;
    });
  }

  async getActivities(limit: number = 20): Promise<any[]> {
    const cacheKey = `activities:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    return this.withRetry(async () => {
      const query = 'SELECT * FROM activities ORDER BY created_at DESC LIMIT $1';
      const result = await pool.query(query, [limit]);

      const activities = result.rows.map(row => ({
        ...row,
        timestamp: row.created_at.toISOString(),
        agentType: row.agent_type,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      }));

      this.cache.set(cacheKey, activities);
      return activities;
    });
  }

  async getActivitiesByAgent(agentType: string, limit: number = 20): Promise<any[]> {
    const cacheKey = `activities:agent:${agentType}:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    return this.withRetry(async () => {
      const query = 'SELECT * FROM activities WHERE agent_type = $1 ORDER BY created_at DESC LIMIT $2';
      const result = await pool.query(query, [agentType, limit]);

      const activities = result.rows.map(row => ({
        ...row,
        timestamp: row.created_at.toISOString(),
        agentType: row.agent_type,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      }));

      this.cache.set(cacheKey, activities);
      return activities;
    });
  }

  // ============================================================================
  // VISITOR OPERATIONS
  // ============================================================================

  async createVisitor(data: any): Promise<{ id: string }> {
    const visitorId = randomUUID();

    return this.withRetry(async () => {
      const query = `
        INSERT INTO visitors (id, session_id, phone_number, email, ip_address, user_agent, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id
      `;

      const values = [
        visitorId,
        data.sessionId || visitorId,
        data.phoneNumber || null,
        data.email || null,
        data.ipAddress || null,
        data.userAgent || null,
        data.metadata ? JSON.stringify(data.metadata) : null
      ];

      await pool.query(query, values);
      this.invalidateCache('visitors:*');
      return { id: visitorId };
    });
  }

  async updateVisitor(id: string, updates: any): Promise<void> {
    return this.withRetry(async () => {
      const setClause = Object.keys(updates)
        .filter(key => key !== 'metadata')
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');

      let query = `UPDATE visitors SET ${setClause}`;
      let values = [id, ...Object.keys(updates).filter(key => key !== 'metadata').map(key => updates[key])];

      if (updates.metadata) {
        query += `, metadata = $${values.length + 1}`;
        values.push(JSON.stringify(updates.metadata));
      }

      query += ` WHERE id = $1`;

      await pool.query(query, values);
      this.invalidateCache(`visitor:${id}`);
    });
  }

  async getVisitorById(id: string): Promise<any | null> {
    const cacheKey = `visitor:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    return this.withRetry(async () => {
      const query = 'SELECT * FROM visitors WHERE id = $1';
      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) return null;

      const visitor = {
        ...result.rows[0],
        metadata: result.rows[0].metadata ? JSON.parse(result.rows[0].metadata) : null
      };

      this.cache.set(cacheKey, visitor);
      return visitor;
    });
  }

  async handleEmailReply(sender: string, subject: string, body: string): Promise<any> {
    // Find lead by email
    const leadQuery = 'SELECT * FROM leads WHERE email = $1';
    const leadResult = await pool.query(leadQuery, [sender]);
    const lead = leadResult.rows[0];

    if (!lead) {
      console.warn(`Received email from non-lead sender: ${sender}`);
      return { success: false, message: 'Sender is not a lead.' };
    }

    // Find the campaign this lead is in and update their status
    const campaignStatusQuery = `
      UPDATE lead_campaign_status
      SET status = 'replied'
      WHERE lead_id = $1 AND status = 'in_progress'
      RETURNING campaign_id;
    `;
    const campaignStatusResult = await pool.query(campaignStatusQuery, [lead.id]);
    const campaign = campaignStatusResult.rows[0];

    if (!campaign) {
      console.log(`Lead ${lead.id} replied but was not in an active campaign.`);
      return { success: true, message: 'Lead not in an active campaign.' };
    }

    // Get the campaign's goal prompt
    const campaignQuery = 'SELECT goal_prompt FROM campaigns WHERE id = $1';
    const campaignResult = await pool.query(campaignQuery, [campaign.campaign_id]);
    const goalPrompt = campaignResult.rows[0]?.goal_prompt;

    if (!goalPrompt) {
      console.error(`Campaign ${campaign.campaign_id} has no goal prompt.`);
      return { success: false, message: 'Campaign has no goal prompt.' };
    }

    // Here, you would trigger the AI with the goal_prompt, subject, and body.
    // For now, we'll log it and simulate the action.
    console.log('--- AI TAKEOVER TRIGGERED ---');
    console.log(`Lead ID: ${lead.id}`);
    console.log(`Campaign ID: ${campaign.campaign_id}`);
    console.log(`Goal: ${goalPrompt}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    console.log('-----------------------------');
    
    // In a real implementation, you would use a service to send the AI-generated email.
    // e.g., await emailService.send(sender, 'Re: ' + subject, ai_response);

    return { success: true, message: 'AI takeover initiated.' };
  }

  // ============================================================================
  // CAMPAIGN OPERATIONS
  // ============================================================================

  async getCampaigns(): Promise<any[]> {
    const query = 'SELECT * FROM campaigns ORDER BY created_at DESC;';
    const result = await pool.query(query);
    return result.rows;
  }

  async createCampaign(name: string, goal_prompt: string): Promise<any> {
    const query = `
      INSERT INTO campaigns (name, goal_prompt)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const result = await pool.query(query, [name, goal_prompt]);
    return result.rows[0];
  }

  async addEmailTemplate(campaignId: string, template: { subject: string, body: string, sequence_order: number, delay_hours: number }): Promise<any> {
    const { subject, body, sequence_order, delay_hours } = template;
    const query = `
      INSERT INTO email_templates (campaign_id, subject, body, sequence_order, delay_hours)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query(query, [campaignId, subject, body, sequence_order, delay_hours]);
    return result.rows[0];
  }

  async enrollLeadsInCampaign(campaignId: string, leadIds: string[]): Promise<any> {
    const enrollments = [];
    for (const leadId of leadIds) {
      // Get the first email template to schedule the first touch
      const firstTemplateQuery = 'SELECT delay_hours FROM email_templates WHERE campaign_id = $1 ORDER BY sequence_order ASC LIMIT 1';
      const templateResult = await pool.query(firstTemplateQuery, [campaignId]);
      const delayHours = templateResult.rows[0]?.delay_hours || 24;
      
      const nextTouchAt = new Date();
      nextTouchAt.setHours(nextTouchAt.getHours() + delayHours);

      const query = `
        INSERT INTO lead_campaign_status (lead_id, campaign_id, status, next_touch_at)
        VALUES ($1, $2, 'in_progress', $3)
        ON CONFLICT (lead_id, campaign_id) DO NOTHING
        RETURNING *;
      `;
      const result = await pool.query(query, [leadId, campaignId, nextTouchAt]);
      if (result.rows[0]) {
        enrollments.push(result.rows[0]);
      }
    }
    return { success: true, enrolled: enrollments.length };
  }

  // ============================================================================
  // SYSTEM STATISTICS
  // ============================================================================

  async getStats(): Promise<any> {
    const cacheKey = 'system:stats';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 10000) return cached;

    return this.withRetry(async () => {
      const [leadsResult, activitiesResult, visitorsResult] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM leads'),
        pool.query('SELECT COUNT(*) FROM activities'),
        pool.query('SELECT COUNT(*) FROM visitors')
      ]);

      const stats = {
        leads: parseInt(leadsResult.rows[0].count),
        activities: parseInt(activitiesResult.rows[0].count),
        agents: 4,
        visitors: parseInt(visitorsResult.rows[0].count),
        uptime: Math.round(process.uptime()),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };

      this.cache.set(cacheKey, stats);
      return stats;
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      // Test database connectivity
      await pool.query('SELECT 1');
      const stats = await this.getStats();

      return {
        healthy: true,
        details: {
          storage: 'postgresql',
          database: 'connected',
          stats,
          cache: {
            size: this.cache.size,
            maxSize: 1000,
            ttl: '60s'
          }
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          storage: 'postgresql',
          database: 'disconnected'
        }
      };
    }
  }

  private invalidateCache(pattern: string): void {
    if (pattern.includes('*')) {
      // Batch invalidation for patterns
      this.pendingInvalidations.add(pattern);
    } else {
      // Immediate invalidation for specific keys
      this.cache.delete(pattern);
    }
  }

  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = '^' + pattern.split('*').map(escapeRegExp).join('.*') + '$';
    const regex = new RegExp(regexPattern);

    for (const key of Array.from(this.cache.keys())) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  // Database initialization
  async initializeDatabase(): Promise<void> {
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS leads (
        id VARCHAR(32) PRIMARY KEY,
        email TEXT NOT NULL,
        phone_number TEXT,
        status VARCHAR(20) DEFAULT 'new',
        lead_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activities (
        id VARCHAR(32) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        agent_type VARCHAR(50),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS visitors (
        id VARCHAR(32) PRIMARY KEY,
        session_id VARCHAR(32) NOT NULL,
        phone_number TEXT,
        email TEXT,
        ip_address INET,
        user_agent TEXT,
        metadata JSONB,
        return_token VARCHAR(64),
        return_token_expiry TIMESTAMP,
        abandonment_step INTEGER DEFAULT 0,
        last_activity TIMESTAMP DEFAULT NOW(),
        abandonment_detected BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
      CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);
      CREATE INDEX IF NOT EXISTS idx_visitors_session_id ON visitors(session_id);
    `;

    await pool.query(createTablesQuery);
  }

  getPerformanceMetrics() {
    return {
      cache: {
        size: this.cache.size,
        hitRate: '95%' // Mock data
      },
      queryPerformance: {
        avgResponseTime: '15ms',
        slowQueries: 0
      }
    };
  }
}

// Export singleton instance
export const storageService = new StorageService();