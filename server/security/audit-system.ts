import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Enterprise-grade security audit and compliance system

interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: 'auth' | 'data_access' | 'config_change' | 'security_violation' | 'system_event';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip: string;
  userAgent: string;
  resource: string;
  action: string;
  outcome: 'success' | 'failure' | 'blocked';
  details: any;
  riskScore: number;
}

class SecurityAuditSystem {
  private events: AuditEvent[] = [];
  private maxEvents = 10000;
  private auditLogPath = path.join(process.cwd(), 'logs', 'security-audit.log');

  constructor() {
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory() {
    const logDir = path.dirname(this.auditLogPath);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create audit log directory:', error);
    }
  }

  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp' | 'riskScore'>) {
    const auditEvent: AuditEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      riskScore: this.calculateRiskScore(event)
    };

    this.events.push(auditEvent);

    // Keep only the most recent events in memory
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Write critical events to file immediately
    if (auditEvent.severity === 'critical' || auditEvent.severity === 'high') {
      await this.writeToAuditLog(auditEvent);
    }

    // Alert on high-risk events
    if (auditEvent.riskScore >= 7) {
      this.triggerSecurityAlert(auditEvent);
    }
  }

  private calculateRiskScore(event: Omit<AuditEvent, 'id' | 'timestamp' | 'riskScore'>): number {
    let score = 0;

    // Base score by event type
    switch (event.eventType) {
      case 'security_violation': score += 5; break;
      case 'auth': score += 2; break;
      case 'data_access': score += 3; break;
      case 'config_change': score += 4; break;
      case 'system_event': score += 1; break;
    }

    // Adjust by severity
    switch (event.severity) {
      case 'critical': score += 4; break;
      case 'high': score += 3; break;
      case 'medium': score += 2; break;
      case 'low': score += 1; break;
    }

    // Adjust by outcome
    if (event.outcome === 'failure' || event.outcome === 'blocked') {
      score += 2;
    }

    return Math.min(score, 10); // Cap at 10
  }

  private async writeToAuditLog(event: AuditEvent) {
    try {
      const logEntry = JSON.stringify(event) + '\n';
      await fs.appendFile(this.auditLogPath, logEntry);
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  private triggerSecurityAlert(event: AuditEvent) {
    console.error(`🚨 SECURITY ALERT [Risk Score: ${event.riskScore}/10]`, {
      eventType: event.eventType,
      severity: event.severity,
      ip: event.ip,
      resource: event.resource,
      action: event.action,
      outcome: event.outcome,
      timestamp: event.timestamp.toISOString()
    });

    // In production, this could trigger notifications, emails, or integration with SIEM systems
  }

  getAuditSummary(hours: number = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentEvents = this.events.filter(e => e.timestamp >= cutoff);

    const summary = {
      totalEvents: recentEvents.length,
      eventsByType: {} as Record<string, number>,
      eventsBySeverity: {} as Record<string, number>,
      riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      topRiskyIPs: [] as { ip: string; riskScore: number; eventCount: number }[],
      complianceScore: 0
    };

    recentEvents.forEach(event => {
      summary.eventsByType[event.eventType] = (summary.eventsByType[event.eventType] || 0) + 1;
      summary.eventsBySeverity[event.severity] = (summary.eventsBySeverity[event.severity] || 0) + 1;

      if (event.riskScore <= 3) summary.riskDistribution.low++;
      else if (event.riskScore <= 5) summary.riskDistribution.medium++;
      else if (event.riskScore <= 7) summary.riskDistribution.high++;
      else summary.riskDistribution.critical++;
    });

    // Calculate compliance score (based on low-risk events vs high-risk events)
    const lowRiskEvents = summary.riskDistribution.low + summary.riskDistribution.medium;
    const highRiskEvents = summary.riskDistribution.high + summary.riskDistribution.critical;
    summary.complianceScore = Math.max(0, Math.min(100, 
      Math.round(((lowRiskEvents - highRiskEvents) / Math.max(1, recentEvents.length)) * 100)
    ));

    return summary;
  }

  // Middleware for automatic audit logging
  auditMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      res.on('finish', async () => {
        const duration = Date.now() - startTime;
        
        // Determine event type based on path
        let eventType: AuditEvent['eventType'] = 'system_event';
        if (req.path.includes('/auth') || req.path.includes('/login')) eventType = 'auth';
        else if (req.path.includes('/api/')) eventType = 'data_access';
        else if (req.path.includes('/config') || req.path.includes('/settings')) eventType = 'config_change';

        // Determine severity based on status code and duration
        let severity: AuditEvent['severity'] = 'low';
        if (res.statusCode >= 500) severity = 'critical';
        else if (res.statusCode >= 400) severity = 'high';
        else if (duration > 5000) severity = 'medium';

        // Determine outcome
        let outcome: AuditEvent['outcome'] = 'success';
        if (res.statusCode >= 400) outcome = 'failure';
        if (res.statusCode === 403 || res.statusCode === 429) outcome = 'blocked';

        await this.logEvent({
          eventType,
          severity,
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          resource: req.path,
          action: req.method,
          outcome,
          details: {
            statusCode: res.statusCode,
            duration,
            queryParams: Object.keys(req.query).length > 0 ? req.query : undefined,
            contentLength: res.get('Content-Length')
          }
        });
      });

      next();
    };
  }
}

export const auditSystem = new SecurityAuditSystem();

// Data Loss Prevention (DLP) system
class DataLossPreventionSystem {
  private sensitivePatterns = [
    { name: 'SSN', pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g, risk: 'high' },
    { name: 'Credit Card', pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, risk: 'high' },
    { name: 'Email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, risk: 'medium' },
    { name: 'Phone', pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, risk: 'medium' },
    { name: 'API Key', pattern: /\b[A-Za-z0-9]{32,}\b/g, risk: 'high' }
  ];

  scanForSensitiveData(data: any): { violations: any[], riskLevel: string } {
    const violations: any[] = [];
    let maxRisk = 'low';

    const scanText = (text: string, context: string) => {
      this.sensitivePatterns.forEach(pattern => {
        const matches = text.match(pattern.pattern);
        if (matches) {
          violations.push({
            type: pattern.name,
            context,
            matchCount: matches.length,
            risk: pattern.risk
          });
          if (pattern.risk === 'high') maxRisk = 'high';
          else if (pattern.risk === 'medium' && maxRisk !== 'high') maxRisk = 'medium';
        }
      });
    };

    const scanObject = (obj: any, path: string = '') => {
      if (typeof obj === 'string') {
        scanText(obj, path);
      } else if (typeof obj === 'object' && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => {
          scanObject(value, path ? `${path}.${key}` : key);
        });
      }
    };

    scanObject(data);
    return { violations, riskLevel: maxRisk };
  }

  // Middleware for DLP scanning
  dlpMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (req.body && Object.keys(req.body).length > 0) {
        const scanResult = this.scanForSensitiveData(req.body);
        
        if (scanResult.violations.length > 0) {
          await auditSystem.logEvent({
            eventType: 'security_violation',
            severity: scanResult.riskLevel === 'high' ? 'critical' : 'high',
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            resource: req.path,
            action: 'DLP_VIOLATION',
            outcome: 'blocked',
            details: { violations: scanResult.violations }
          });

          if (scanResult.riskLevel === 'high') {
            return res.status(400).json({
              success: false,
              error: {
                code: 'SENSITIVE_DATA_DETECTED',
                message: 'Request contains sensitive data that cannot be processed',
                category: 'security',
                retryable: false
              }
            });
          }
        }
      }

      next();
    };
  }
}

export const dlpSystem = new DataLossPreventionSystem();