
import { Router } from 'express';
import { auditLogger } from '../middleware/security-enhanced';
import { validatePagination, validateDateRange } from '../middleware/request-validation';
import { rateLimitMiddleware } from '../middleware/security';

const router = Router();

// Apply strict rate limiting for audit endpoints
router.use(rateLimitMiddleware('webhook')); // Strictest rate limit

// Get recent security logs
router.get('/logs', validatePagination, (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query as any;
    const offset = (page - 1) * limit;
    
    const logs = auditLogger.getRecentLogs(limit + offset).slice(offset, offset + limit);
    
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total: auditLogger.getRecentLogs(10000).length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AUDIT_ERROR',
        message: 'Failed to retrieve audit logs',
        category: 'server',
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Get logs by severity
router.get('/logs/severity/:severity', (req, res) => {
  try {
    const { severity } = req.params;
    
    if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SEVERITY',
          message: 'Severity must be one of: low, medium, high, critical',
          category: 'validation',
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const logs = auditLogger.getLogsBySeverity(severity as any);
    
    res.json({
      success: true,
      data: { logs },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AUDIT_ERROR',
        message: 'Failed to retrieve logs by severity',
        category: 'server',
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Get security statistics
router.get('/stats', (req, res) => {
  try {
    const recentLogs = auditLogger.getRecentLogs(1000);
    
    const stats = {
      totalEvents: recentLogs.length,
      criticalEvents: recentLogs.filter(log => log.severity === 'critical').length,
      highSeverityEvents: recentLogs.filter(log => log.severity === 'high').length,
      mediumSeverityEvents: recentLogs.filter(log => log.severity === 'medium').length,
      lowSeverityEvents: recentLogs.filter(log => log.severity === 'low').length,
      uniqueIPs: new Set(recentLogs.map(log => log.ip)).size,
      topEvents: Object.entries(
        recentLogs.reduce((acc, log) => {
          acc[log.event] = (acc[log.event] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      )
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([event, count]) => ({ event, count })),
    };
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AUDIT_ERROR',
        message: 'Failed to generate security statistics',
        category: 'server',
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
