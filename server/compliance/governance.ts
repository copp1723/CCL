import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Enterprise compliance and governance system for SOC 2 and ISO 27001

interface ComplianceEvent {
  id: string;
  timestamp: Date;
  eventType: 'data_access' | 'data_modification' | 'privileged_action' | 'configuration_change';
  actor: string;
  resource: string;
  action: string;
  outcome: 'success' | 'failure';
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  dataClassification: string[];
  justification?: string;
  approvalRequired: boolean;
  retentionPeriod: number; // days
}

interface DataRetentionPolicy {
  category: string;
  retentionPeriod: number; // days
  autoDelete: boolean;
  requiresApproval: boolean;
  encryptionRequired: boolean;
}

class ComplianceGovernanceSystem {
  private events: ComplianceEvent[] = [];
  private retentionPolicies: DataRetentionPolicy[] = [
    {
      category: 'user_data',
      retentionPeriod: 2555, // 7 years for financial data
      autoDelete: false,
      requiresApproval: true,
      encryptionRequired: true
    },
    {
      category: 'system_logs',
      retentionPeriod: 365, // 1 year
      autoDelete: true,
      requiresApproval: false,
      encryptionRequired: false
    },
    {
      category: 'audit_logs',
      retentionPeriod: 2555, // 7 years
      autoDelete: false,
      requiresApproval: true,
      encryptionRequired: true
    },
    {
      category: 'communication_data',
      retentionPeriod: 1095, // 3 years
      autoDelete: false,
      requiresApproval: true,
      encryptionRequired: true
    }
  ];

  private dataClassificationRules = {
    'ssn': 'restricted',
    'credit_card': 'restricted',
    'phone': 'confidential',
    'email': 'confidential',
    'name': 'internal',
    'address': 'confidential',
    'financial_data': 'restricted'
  };

  logComplianceEvent(event: Omit<ComplianceEvent, 'id' | 'timestamp'>) {
    const complianceEvent: ComplianceEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };

    this.events.push(complianceEvent);

    // Apply retention policy
    this.applyRetentionPolicy();

    // Check for compliance violations
    this.checkComplianceViolations(complianceEvent);
  }

  private applyRetentionPolicy() {
    const now = Date.now();
    this.events = this.events.filter(event => {
      const eventAge = now - event.timestamp.getTime();
      const retentionMs = event.retentionPeriod * 24 * 60 * 60 * 1000;
      return eventAge < retentionMs;
    });
  }

  private checkComplianceViolations(event: ComplianceEvent) {
    const violations: string[] = [];

    // Check data access patterns
    if (event.sensitivity === 'restricted' && !event.justification) {
      violations.push('Restricted data access without justification');
    }

    // Check for unusual access patterns
    const recentEvents = this.events.filter(e => 
      e.actor === event.actor && 
      Date.now() - e.timestamp.getTime() < 3600000 // 1 hour
    );

    if (recentEvents.length > 50) {
      violations.push('Unusual access pattern detected');
    }

    if (violations.length > 0) {
      console.warn('COMPLIANCE VIOLATION:', {
        event: event.id,
        actor: event.actor,
        violations,
        timestamp: event.timestamp
      });
    }
  }

  classifyData(data: any): string[] {
    const classifications: string[] = [];
    const dataString = JSON.stringify(data).toLowerCase();

    Object.entries(this.dataClassificationRules).forEach(([pattern, classification]) => {
      if (dataString.includes(pattern)) {
        classifications.push(classification);
      }
    });

    return [...new Set(classifications)];
  }

  getComplianceReport() {
    const now = Date.now();
    const last24h = this.events.filter(e => now - e.timestamp.getTime() < 86400000);
    const last30d = this.events.filter(e => now - e.timestamp.getTime() < 2592000000);

    return {
      totalEvents: this.events.length,
      last24Hours: last24h.length,
      last30Days: last30d.length,
      eventsByType: last30d.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      sensitivityBreakdown: last30d.reduce((acc, event) => {
        acc[event.sensitivity] = (acc[event.sensitivity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      complianceScore: this.calculateComplianceScore(),
      dataRetentionStatus: this.getRetentionStatus()
    };
  }

  private calculateComplianceScore(): number {
    const recentEvents = this.events.filter(e => 
      Date.now() - e.timestamp.getTime() < 2592000000 // 30 days
    );

    if (recentEvents.length === 0) return 100;

    const violations = recentEvents.filter(e => 
      e.sensitivity === 'restricted' && !e.justification
    );

    return Math.max(0, 100 - (violations.length / recentEvents.length * 100));
  }

  private getRetentionStatus() {
    return this.retentionPolicies.map(policy => ({
      category: policy.category,
      eventsCount: this.events.filter(e => 
        e.dataClassification.includes(policy.category)
      ).length,
      retentionPeriod: policy.retentionPeriod,
      autoDelete: policy.autoDelete
    }));
  }

  // Middleware for compliance logging
  complianceMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      res.on('finish', () => {
        // Determine if this is a compliance-relevant event
        const isDataAccess = req.method === 'GET' && req.path.includes('/api/');
        const isDataModification = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
        const isPrivilegedAction = req.path.includes('/admin') || req.path.includes('/config');

        if (isDataAccess || isDataModification || isPrivilegedAction) {
          let eventType: ComplianceEvent['eventType'] = 'data_access';
          if (isDataModification) eventType = 'data_modification';
          if (isPrivilegedAction) eventType = 'privileged_action';

          // Classify data sensitivity
          const dataClassifications = this.classifyData(req.body || {});
          let sensitivity: ComplianceEvent['sensitivity'] = 'public';
          
          if (dataClassifications.includes('restricted')) sensitivity = 'restricted';
          else if (dataClassifications.includes('confidential')) sensitivity = 'confidential';
          else if (dataClassifications.includes('internal')) sensitivity = 'internal';

          this.logComplianceEvent({
            eventType,
            actor: req.ip || 'unknown',
            resource: req.path,
            action: req.method,
            outcome: res.statusCode < 400 ? 'success' : 'failure',
            sensitivity,
            dataClassification: dataClassifications,
            approvalRequired: sensitivity === 'restricted',
            retentionPeriod: this.getRetentionPeriod(dataClassifications)
          });
        }
      });

      next();
    };
  }

  private getRetentionPeriod(classifications: string[]): number {
    if (classifications.includes('restricted')) return 2555; // 7 years
    if (classifications.includes('confidential')) return 1095; // 3 years
    return 365; // 1 year default
  }
}

export const complianceSystem = new ComplianceGovernanceSystem();

export class GDPRComplianceManager {
  private consentRecords = new Map<string, {
    userId: string;
    consentType: string;
    granted: boolean;
    timestamp: Date;
    ipAddress: string;
    version: string;
  }>();

  recordConsent(userId: string, consentType: string, granted: boolean, ipAddress: string) {
    const record = {
      userId,
      consentType,
      granted,
      timestamp: new Date(),
      ipAddress,
      version: '1.0'
    };

    this.consentRecords.set(`${userId}:${consentType}`, record);
  }

  hasConsent(userId: string, consentType: string): boolean {
    const record = this.consentRecords.get(`${userId}:${consentType}`);
    return record?.granted || false;
  }

  generateDataPortabilityReport(userId: string): any {
    return {
      userId,
      generatedAt: new Date(),
      personalData: {},
      consentHistory: Array.from(this.consentRecords.values())
        .filter(record => record.userId === userId),
      dataProcessingActivities: {}
    };
  }

  processDataDeletionRequest(userId: string): { success: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      Array.from(this.consentRecords.keys())
        .filter(key => key.startsWith(userId))
        .forEach(key => this.consentRecords.delete(key));

      return { success: true, errors: [] };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return { success: false, errors };
    }
  }
}

export const gdprManager = new GDPRComplianceManager();