import express, { Request, Response } from 'express';
import { securityMonitor } from '../security/advanced-protection';
import { auditSystem } from '../security/audit-system';
import { threatIntelligence } from '../security/threat-intelligence';
import { complianceSystem } from '../compliance/governance';
import { performanceOptimizer, memoryManager } from '../performance/optimization';

const router = express.Router();

// Enterprise security monitoring endpoints
router.get('/security/dashboard', async (req: Request, res: Response) => {
  try {
    const securityReport = securityMonitor.getSecurityReport();
    const auditSummary = auditSystem.getAuditSummary(24);
    const threatReport = threatIntelligence.getThreatReport();
    const complianceReport = complianceSystem.getComplianceReport();
    const performanceMetrics = performanceOptimizer.getPerformanceMetrics();
    const memoryStats = memoryManager.getMemoryStats();

    const dashboard = {
      timestamp: new Date().toISOString(),
      security: {
        totalEvents: securityReport.totalEvents,
        recentEvents: securityReport.recentEvents,
        blockedIPs: securityReport.blockedIPs.length,
        riskLevel: securityReport.recentEvents > 50 ? 'high' : 
                  securityReport.recentEvents > 20 ? 'medium' : 'low'
      },
      audit: {
        complianceScore: auditSummary.complianceScore,
        totalEvents: auditSummary.totalEvents,
        eventsByType: auditSummary.eventsByType,
        riskDistribution: auditSummary.riskDistribution
      },
      threats: {
        activeProfiles: threatReport.activeProfiles,
        blockedIPs: threatReport.blockedIPs.length,
        recentAlerts: threatReport.recentAlerts,
        averageRiskScore: threatReport.averageRiskScore
      },
      compliance: {
        score: complianceReport.complianceScore,
        events24h: complianceReport.last24Hours,
        sensitivityBreakdown: complianceReport.sensitivityBreakdown
      },
      performance: {
        averageResponseTime: Math.round(performanceMetrics.averageResponseTime),
        slowRequests: performanceMetrics.slowRequests,
        cacheHitRate: Math.round(performanceMetrics.cacheStats.hitRate * 100),
        totalRequests: performanceMetrics.totalRequests
      },
      system: {
        memoryUsage: memoryStats.usagePercent,
        heapUsed: memoryStats.heapUsed,
        uptime: Math.round(process.uptime() / 60) // minutes
      }
    };

    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Security dashboard error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DASHBOARD_ERROR',
        message: 'Failed to generate security dashboard',
        category: 'server_error'
      }
    });
  }
});

// Detailed security reports
router.get('/security/audit-report', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const auditSummary = auditSystem.getAuditSummary(hours);
    
    res.json({
      success: true,
      data: auditSummary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AUDIT_REPORT_ERROR',
        message: 'Failed to generate audit report'
      }
    });
  }
});

router.get('/security/threat-report', async (req: Request, res: Response) => {
  try {
    const threatReport = threatIntelligence.getThreatReport();
    
    res.json({
      success: true,
      data: threatReport,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'THREAT_REPORT_ERROR',
        message: 'Failed to generate threat report'
      }
    });
  }
});

router.get('/security/compliance-report', async (req: Request, res: Response) => {
  try {
    const complianceReport = complianceSystem.getComplianceReport();
    
    res.json({
      success: true,
      data: complianceReport,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'COMPLIANCE_REPORT_ERROR',
        message: 'Failed to generate compliance report'
      }
    });
  }
});

// Performance optimization endpoints
router.get('/performance/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = performanceOptimizer.getPerformanceMetrics();
    const memoryStats = memoryManager.getMemoryStats();
    
    res.json({
      success: true,
      data: {
        ...metrics,
        memory: memoryStats,
        uptime: process.uptime()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PERFORMANCE_METRICS_ERROR',
        message: 'Failed to retrieve performance metrics'
      }
    });
  }
});

router.post('/performance/clear-cache', async (req: Request, res: Response) => {
  try {
    performanceOptimizer.clearCache();
    
    res.json({
      success: true,
      message: 'Performance cache cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_CLEAR_ERROR',
        message: 'Failed to clear cache'
      }
    });
  }
});

// System health and diagnostics
router.get('/system/diagnostics', async (req: Request, res: Response) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      env: process.env.NODE_ENV,
      pid: process.pid,
      versions: process.versions
    };
    
    res.json({
      success: true,
      data: diagnostics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DIAGNOSTICS_ERROR',
        message: 'Failed to retrieve system diagnostics'
      }
    });
  }
});

export default router;