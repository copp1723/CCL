import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Enterprise threat intelligence and behavioral analysis system

interface ThreatSignature {
  id: string;
  name: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'injection' | 'xss' | 'traversal' | 'dos' | 'reconnaissance' | 'brute_force';
  description: string;
}

interface BehaviorProfile {
  ip: string;
  firstSeen: Date;
  lastSeen: Date;
  requestCount: number;
  uniquePaths: Set<string>;
  userAgents: Set<string>;
  errorRate: number;
  avgRequestRate: number;
  suspiciousPatterns: string[];
  riskScore: number;
}

class ThreatIntelligenceSystem {
  private threatSignatures: ThreatSignature[] = [
    {
      id: 'sql-injection-1',
      name: 'SQL Injection Attempt',
      pattern: /(union\s+select|drop\s+table|insert\s+into|update\s+set|delete\s+from|exec\s*\()/i,
      severity: 'critical',
      category: 'injection',
      description: 'SQL injection attack pattern detected'
    },
    {
      id: 'xss-1',
      name: 'Cross-Site Scripting',
      pattern: /(<script|javascript:|onload=|onerror=|eval\s*\(|document\.cookie)/i,
      severity: 'high',
      category: 'xss',
      description: 'XSS attack pattern detected'
    },
    {
      id: 'path-traversal-1',
      name: 'Path Traversal',
      pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/i,
      severity: 'high',
      category: 'traversal',
      description: 'Directory traversal attempt detected'
    },
    {
      id: 'command-injection-1',
      name: 'Command Injection',
      pattern: /(\||\&\&|\|\||;|`|\$\(|exec\s|system\s|cmd\s)/i,
      severity: 'critical',
      category: 'injection',
      description: 'Command injection attempt detected'
    },
    {
      id: 'dos-1',
      name: 'DoS Pattern',
      pattern: /(slowloris|hulk|goldeneye|xerxes)/i,
      severity: 'high',
      category: 'dos',
      description: 'DoS attack tool signature detected'
    },
    {
      id: 'recon-1',
      name: 'Reconnaissance',
      pattern: /(nmap|nikto|dirb|gobuster|wfuzz|sqlmap)/i,
      severity: 'medium',
      category: 'reconnaissance',
      description: 'Reconnaissance tool detected'
    }
  ];

  private behaviorProfiles = new Map<string, BehaviorProfile>();
  private blockedIPs = new Set<string>();
  private alertQueue: any[] = [];

  analyzeRequest(req: Request): { threats: any[], riskScore: number } {
    const threats: any[] = [];
    let totalRiskScore = 0;

    // Analyze URL, headers, and body for threat patterns
    const analysisTargets = [
      { source: 'url', data: req.url },
      { source: 'user-agent', data: req.get('User-Agent') || '' },
      { source: 'body', data: JSON.stringify(req.body || {}) }
    ];

    analysisTargets.forEach(target => {
      this.threatSignatures.forEach(signature => {
        if (signature.pattern.test(target.data)) {
          const threat = {
            signatureId: signature.id,
            name: signature.name,
            severity: signature.severity,
            category: signature.category,
            source: target.source,
            description: signature.description,
            timestamp: new Date()
          };
          threats.push(threat);

          // Calculate risk score
          const severityScore = {
            'low': 1,
            'medium': 3,
            'high': 6,
            'critical': 10
          }[signature.severity];
          totalRiskScore += severityScore;
        }
      });
    });

    return { threats, riskScore: Math.min(totalRiskScore, 10) };
  }

  updateBehaviorProfile(req: Request, responseTime: number, statusCode: number) {
    const clientIP = req.ip || 'unknown';
    const now = new Date();

    let profile = this.behaviorProfiles.get(clientIP);
    if (!profile) {
      profile = {
        ip: clientIP,
        firstSeen: now,
        lastSeen: now,
        requestCount: 0,
        uniquePaths: new Set(),
        userAgents: new Set(),
        errorRate: 0,
        avgRequestRate: 0,
        suspiciousPatterns: [],
        riskScore: 0
      };
      this.behaviorProfiles.set(clientIP, profile);
    }

    // Update profile
    profile.lastSeen = now;
    profile.requestCount++;
    profile.uniquePaths.add(req.path);
    if (req.get('User-Agent')) {
      profile.userAgents.add(req.get('User-Agent')!);
    }

    // Calculate error rate
    if (statusCode >= 400) {
      profile.errorRate = (profile.errorRate * (profile.requestCount - 1) + 1) / profile.requestCount;
    } else {
      profile.errorRate = (profile.errorRate * (profile.requestCount - 1)) / profile.requestCount;
    }

    // Calculate request rate (requests per minute)
    const timeSpan = (now.getTime() - profile.firstSeen.getTime()) / 60000; // minutes
    profile.avgRequestRate = profile.requestCount / Math.max(timeSpan, 1);

    // Calculate behavioral risk score
    profile.riskScore = this.calculateBehavioralRisk(profile);

    // Auto-block high-risk IPs
    if (profile.riskScore >= 8) {
      this.blockedIPs.add(clientIP);
      this.queueAlert({
        type: 'high_risk_behavior',
        ip: clientIP,
        riskScore: profile.riskScore,
        details: {
          requestCount: profile.requestCount,
          errorRate: profile.errorRate,
          requestRate: profile.avgRequestRate,
          uniquePaths: profile.uniquePaths.size,
          userAgents: profile.userAgents.size
        }
      });
    }
  }

  private calculateBehavioralRisk(profile: BehaviorProfile): number {
    let risk = 0;

    // High request rate (potential DoS)
    if (profile.avgRequestRate > 100) risk += 3;
    else if (profile.avgRequestRate > 50) risk += 2;
    else if (profile.avgRequestRate > 20) risk += 1;

    // High error rate (potential scanning)
    if (profile.errorRate > 0.5) risk += 3;
    else if (profile.errorRate > 0.3) risk += 2;
    else if (profile.errorRate > 0.1) risk += 1;

    // Multiple user agents (potential bot)
    if (profile.userAgents.size > 5) risk += 2;
    else if (profile.userAgents.size > 3) risk += 1;

    // Path scanning behavior
    if (profile.uniquePaths.size > 50) risk += 2;
    else if (profile.uniquePaths.size > 20) risk += 1;

    return Math.min(risk, 10);
  }

  private queueAlert(alert: any) {
    this.alertQueue.push({
      ...alert,
      timestamp: new Date(),
      id: crypto.randomUUID()
    });

    // Keep only last 100 alerts
    if (this.alertQueue.length > 100) {
      this.alertQueue.shift();
    }

    console.warn('🚨 THREAT ALERT:', alert);
  }

  isBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  getThreatReport() {
    const now = Date.now();
    const recentAlerts = this.alertQueue.filter(alert => 
      now - new Date(alert.timestamp).getTime() < 3600000 // 1 hour
    );

    const behaviorStats = Array.from(this.behaviorProfiles.values())
      .filter(profile => now - profile.lastSeen.getTime() < 3600000);

    return {
      totalProfiles: this.behaviorProfiles.size,
      activeProfiles: behaviorStats.length,
      blockedIPs: Array.from(this.blockedIPs),
      recentAlerts: recentAlerts.length,
      threatCategories: this.alertQueue.reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {}),
      highRiskProfiles: behaviorStats.filter(p => p.riskScore >= 6).length,
      averageRiskScore: behaviorStats.length > 0 
        ? behaviorStats.reduce((sum, p) => sum + p.riskScore, 0) / behaviorStats.length 
        : 0
    };
  }

  // Middleware for threat detection
  threatDetectionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIP = req.ip || 'unknown';

      // Check if IP is blocked
      if (this.isBlocked(clientIP)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'IP_BLOCKED_THREAT',
            message: 'Access denied due to security violations',
            category: 'security',
            retryable: false
          }
        });
      }

      // Analyze request for threats
      const analysis = this.analyzeRequest(req);
      
      if (analysis.threats.length > 0) {
        this.queueAlert({
          type: 'threat_detected',
          ip: clientIP,
          threats: analysis.threats,
          riskScore: analysis.riskScore,
          path: req.path,
          method: req.method
        });

        // Block high-risk requests immediately
        if (analysis.riskScore >= 8) {
          this.blockedIPs.add(clientIP);
          return res.status(400).json({
            success: false,
            error: {
              code: 'THREAT_DETECTED',
              message: 'Request blocked due to security threat',
              category: 'security',
              retryable: false
            }
          });
        }
      }

      // Track request timing for behavioral analysis
      const startTime = Date.now();
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.updateBehaviorProfile(req, responseTime, res.statusCode);
      });

      next();
    };
  }
}

export const threatIntelligence = new ThreatIntelligenceSystem();