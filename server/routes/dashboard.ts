import { Router } from 'express';
import { storage } from '../storage';
import { boberdooService } from '../services/boberdoo-service';
import { twilioSms } from '../services/twilio-sms';
import { sftpIngestor } from '../services/sftp-ingestor';
import { abandonmentDetector } from '../jobs/abandonment-detector';
import { outreachOrchestrator } from '../jobs/outreach-orchestrator';
import { logger } from '../logger';
import config from '../config/environment';

const router = Router();
const dashboardLogger = logger.child({ component: 'DashboardAPI' });

/**
 * GET /api/dashboard/overview
 * Get comprehensive dashboard overview with key metrics
 */
router.get('/overview', async (req, res) => {
  try {
    dashboardLogger.info('Dashboard overview requested');

    // Get lead metrics
    const leadMetrics = await storage.getLeadMetrics();
    
    // Get conversion funnel
    const conversionFunnel = await storage.getConversionFunnel();
    
    // Get revenue metrics
    const revenueMetrics = await storage.getRevenueMetrics();
    
    // Get outreach statistics
    const outreachStats = await outreachOrchestrator.getOutreachStats();
    
    // Get service health
    const serviceHealth = await getServiceHealth();
    
    // Calculate key performance indicators
    const kpis = calculateKPIs(leadMetrics, revenueMetrics, outreachStats);

    const overview = {
      timestamp: new Date().toISOString(),
      summary: {
        totalVisitors: leadMetrics.totalVisitors,
        totalLeads: leadMetrics.submitted + leadMetrics.accepted,
        totalRevenue: revenueMetrics.totalRevenue,
        conversionRate: kpis.overallConversionRate,
        averageRevenuePerLead: kpis.averageRevenuePerLead
      },
      leadMetrics,
      conversionFunnel,
      revenueMetrics,
      outreachStats,
      serviceHealth,
      kpis
    };

    res.json(overview);
  } catch (error) {
    dashboardLogger.error('Error getting dashboard overview', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      error: 'Failed to retrieve dashboard overview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/dashboard/revenue
 * Get detailed revenue analytics
 */
router.get('/revenue', async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    dashboardLogger.info('Revenue analytics requested', { timeframe });

    // Get revenue over time
    const revenueOverTime = await storage.getRevenueOverTime(timeframe as string);
    
    // Get revenue by source
    const revenueBySource = await storage.getRevenueBySource();
    
    // Get Boberdoo performance
    const boberdooStats = boberdooService.getStats();
    
    // Get top performing lead sources
    const topSources = await storage.getTopPerformingSources();

    const revenue = {
      timestamp: new Date().toISOString(),
      timeframe,
      revenueOverTime,
      revenueBySource,
      boberdooPerformance: {
        submissionCount: boberdooStats.submissionCount,
        successRate: boberdooStats.successRate,
        averagePrice: await storage.getAverageBoberdooPrice(),
        totalRevenue: await storage.getTotalBoberdooRevenue()
      },
      topSources,
      projections: calculateRevenueProjections(revenueOverTime)
    };

    res.json(revenue);
  } catch (error) {
    dashboardLogger.error('Error getting revenue analytics', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      error: 'Failed to retrieve revenue analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/dashboard/conversion-funnel
 * Get detailed conversion funnel analysis
 */
router.get('/conversion-funnel', async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    dashboardLogger.info('Conversion funnel requested', { timeframe });

    // Get funnel stages
    const funnelData = await storage.getConversionFunnelDetailed(timeframe as string);
    
    // Get abandonment analysis
    const abandonmentAnalysis = await abandonmentDetector.getAbandonmentStats();
    
    // Get recovery performance
    const recoveryStats = await storage.getRecoveryStats();
    
    // Get PII collection performance
    const piiStats = await storage.getPiiCollectionStats();

    const funnel = {
      timestamp: new Date().toISOString(),
      timeframe,
      stages: funnelData,
      abandonmentAnalysis,
      recoveryPerformance: {
        ...recoveryStats,
        recoveryRate: recoveryStats.totalAttempts > 0 
          ? (recoveryStats.successful / recoveryStats.totalAttempts * 100).toFixed(2)
          : 0
      },
      piiCollection: {
        ...piiStats,
        completionRate: piiStats.totalStarted > 0
          ? (piiStats.completed / piiStats.totalStarted * 100).toFixed(2)
          : 0
      },
      optimizationOpportunities: identifyOptimizationOpportunities(funnelData, abandonmentAnalysis)
    };

    res.json(funnel);
  } catch (error) {
    dashboardLogger.error('Error getting conversion funnel', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      error: 'Failed to retrieve conversion funnel',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/dashboard/boberdoo
 * Get Boberdoo marketplace performance
 */
router.get('/boberdoo', async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    dashboardLogger.info('Boberdoo analytics requested', { timeframe });

    // Get Boberdoo service stats
    const boberdooStats = boberdooService.getStats();
    
    // Get submission history
    const submissionHistory = await storage.getBoberdooSubmissionHistory(timeframe as string);
    
    // Get acceptance rates by buyer
    const buyerPerformance = await storage.getBoberdooBuyerPerformance();
    
    // Get revenue breakdown
    const revenueBreakdown = await storage.getBoberdooRevenueBreakdown();
    
    // Get dead letter queue status
    const dlqStatus = boberdooService.getDeadLetterQueue();

    const boberdoo = {
      timestamp: new Date().toISOString(),
      timeframe,
      overview: {
        configured: boberdooStats.configured,
        totalSubmissions: boberdooStats.submissionCount,
        successRate: boberdooStats.successRate,
        totalRevenue: revenueBreakdown.totalRevenue,
        averagePrice: revenueBreakdown.averagePrice
      },
      submissionHistory,
      buyerPerformance,
      revenueBreakdown,
      deadLetterQueue: {
        size: dlqStatus.length,
        retryableCount: dlqStatus.filter(item => item.canRetry).length,
        oldestEntry: dlqStatus.length > 0 ? Math.min(...dlqStatus.map(item => item.lastAttempt.getTime())) : null
      },
      recommendations: generateBoberdooRecommendations(boberdooStats, buyerPerformance)
    };

    res.json(boberdoo);
  } catch (error) {
    dashboardLogger.error('Error getting Boberdoo analytics', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      error: 'Failed to retrieve Boberdoo analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Helper Functions
 */

async function getServiceHealth() {
  const services = {
    database: { healthy: false, configured: false, error: null },
    boberdoo: { healthy: false, configured: false, error: null },
    twilio: { healthy: false, configured: false, error: null },
    sftp: { healthy: false, configured: false, error: null },
    abandonment: { healthy: false, configured: false, error: null },
    outreach: { healthy: false, configured: false, error: null }
  };

  try {
    // Database health
    const dbHealth = await storage.healthCheck();
    services.database = { healthy: dbHealth.healthy, configured: true, error: dbHealth.error };
  } catch (error) {
    services.database.error = error instanceof Error ? error.message : 'Unknown error';
  }

  try {
    // Boberdoo health
    const boberdooHealth = await boberdooService.healthCheck();
    services.boberdoo = {
      healthy: boberdooHealth.healthy,
      configured: boberdooHealth.configured,
      error: boberdooHealth.error
    };
  } catch (error) {
    services.boberdoo.error = error instanceof Error ? error.message : 'Unknown error';
  }

  try {
    // Twilio health
    const twilioHealth = await twilioSms.healthCheck();
    services.twilio = {
      healthy: twilioHealth.healthy,
      configured: twilioHealth.configured,
      error: twilioHealth.error
    };
  } catch (error) {
    services.twilio.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return services;
}

function calculateKPIs(leadMetrics: any, revenueMetrics: any, outreachStats: any) {
  const overallConversionRate = leadMetrics.totalVisitors > 0
    ? ((leadMetrics.submitted + leadMetrics.accepted) / leadMetrics.totalVisitors * 100).toFixed(2)
    : 0;

  const averageRevenuePerLead = (leadMetrics.submitted + leadMetrics.accepted) > 0
    ? (revenueMetrics.totalRevenue / (leadMetrics.submitted + leadMetrics.accepted)).toFixed(2)
    : 0;

  const recoveryRate = leadMetrics.abandoned > 0
    ? (leadMetrics.contacted / leadMetrics.abandoned * 100).toFixed(2)
    : 0;

  return {
    overallConversionRate: parseFloat(overallConversionRate),
    averageRevenuePerLead: parseFloat(averageRevenuePerLead),
    recoveryRate: parseFloat(recoveryRate),
    outreachEffectiveness: outreachStats.responseRate
  };
}

function calculateRevenueProjections(revenueOverTime: any[]) {
  if (revenueOverTime.length < 7) {
    return { projection: 0, confidence: 'low' };
  }

  // Simple linear projection based on recent trend
  const recentData = revenueOverTime.slice(-7); // Last 7 days
  const totalRevenue = recentData.reduce((sum, day) => sum + day.revenue, 0);
  const dailyAverage = totalRevenue / 7;
  
  const monthlyProjection = dailyAverage * 30;
  
  return {
    dailyAverage: parseFloat(dailyAverage.toFixed(2)),
    monthlyProjection: parseFloat(monthlyProjection.toFixed(2)),
    confidence: recentData.length >= 7 ? 'medium' : 'low'
  };
}

function identifyOptimizationOpportunities(funnelData: any, abandonmentAnalysis: any) {
  const opportunities = [];

  // Analyze abandonment patterns
  if (abandonmentAnalysis.byStep) {
    const highAbandonmentSteps = abandonmentAnalysis.byStep
      .filter((step: any) => step.count > abandonmentAnalysis.total * 0.2)
      .map((step: any) => step.step);
    
    if (highAbandonmentSteps.length > 0) {
      opportunities.push({
        type: 'abandonment',
        priority: 'high',
        description: `High abandonment at steps: ${highAbandonmentSteps.join(', ')}`,
        recommendation: 'Review user experience and add progressive assistance'
      });
    }
  }

  return opportunities;
}

function generateBoberdooRecommendations(boberdooStats: any, buyerPerformance: any) {
  const recommendations = [];

  if (boberdooStats.successRate < 80) {
    recommendations.push({
      type: 'data_quality',
      priority: 'high',
      description: 'Low success rate suggests data quality issues',
      action: 'Review PII validation and lead quality before submission'
    });
  }

  if (buyerPerformance && buyerPerformance.length > 0) {
    const topBuyer = buyerPerformance[0];
    if (topBuyer && topBuyer.acceptanceRate > 90) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        description: `High-performing buyer identified: ${topBuyer.buyerId}`,
        action: 'Consider prioritizing submissions to high-acceptance buyers'
      });
    }
  }

  return recommendations;
}

export default router;