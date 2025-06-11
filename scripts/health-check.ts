#!/usr/bin/env tsx
/**
 * Health Check Script for MVP Automation Pipeline
 *
 * This script checks the health of all MVP automation services
 * and provides a comprehensive status report.
 */

import { sftpIngestor } from "../server/services/sftp-ingestor";
import { abandonmentDetector } from "../server/jobs/abandonment-detector";
import { outreachOrchestrator } from "../server/jobs/outreach-orchestrator";
import { twilioSms } from "../server/services/twilio-sms";
import { storage } from "../server/storage";
import config from "../server/config/environment";
import { logger } from "../server/logger";

interface HealthCheckResult {
  service: string;
  healthy: boolean;
  configured: boolean;
  details?: any;
  error?: string;
}

async function runHealthChecks(): Promise<HealthCheckResult[]> {
  const checks: HealthCheckResult[] = [];

  console.log("🔍 Running MVP Automation Pipeline Health Checks...\n");

  // Database health check
  try {
    const dbHealth = await storage.healthCheck();
    checks.push({
      service: "Database",
      healthy: dbHealth.healthy,
      configured: true,
      error: dbHealth.error,
    });
  } catch (error) {
    checks.push({
      service: "Database",
      healthy: false,
      configured: true,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // SFTP Ingestion health check
  try {
    const sftpConfig = config.getSftpConfig();
    const sftpHealth = await sftpIngestor.healthCheck();
    checks.push({
      service: "SFTP Ingestion",
      healthy: sftpHealth.healthy,
      configured: sftpConfig.configured,
      details: {
        host: sftpConfig.host,
        remotePath: sftpConfig.remotePath,
        pollInterval: `${sftpConfig.pollIntervalMinutes} minutes`,
      },
      error: sftpHealth.error,
    });
  } catch (error) {
    checks.push({
      service: "SFTP Ingestion",
      healthy: false,
      configured: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // Abandonment Detection health check
  try {
    const abandonmentHealth = await abandonmentDetector.healthCheck();
    const abandonmentConfig = config.getAbandonmentConfig();
    checks.push({
      service: "Abandonment Detection",
      healthy: abandonmentHealth.healthy,
      configured: true,
      details: {
        thresholdMinutes: abandonmentConfig.thresholdMinutes,
        tokenExpiryHours: abandonmentConfig.returnTokenExpiryHours,
        isRunning: abandonmentDetector.isCurrentlyRunning(),
        nextRun: abandonmentDetector.getNextRunTime(),
      },
      error: abandonmentHealth.error,
    });
  } catch (error) {
    checks.push({
      service: "Abandonment Detection",
      healthy: false,
      configured: true,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // Outreach Orchestrator health check
  try {
    const outreachHealth = await outreachOrchestrator.healthCheck();
    checks.push({
      service: "Outreach Orchestrator",
      healthy: outreachHealth.healthy,
      configured: true,
      details: {
        isRunning: outreachOrchestrator.isCurrentlyRunning(),
        nextRun: outreachOrchestrator.getNextRunTime(),
      },
      error: outreachHealth.error,
    });
  } catch (error) {
    checks.push({
      service: "Outreach Orchestrator",
      healthy: false,
      configured: true,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // Twilio SMS health check
  try {
    const twilioHealth = await twilioSms.healthCheck();
    const twilioInfo = twilioSms.getServiceInfo();
    checks.push({
      service: "Twilio SMS",
      healthy: twilioHealth.healthy,
      configured: twilioInfo.configured,
      details: {
        accountSid: twilioInfo.accountSid,
        outboundNumber: twilioInfo.outboundNumber,
      },
      error: twilioHealth.error,
    });
  } catch (error) {
    checks.push({
      service: "Twilio SMS",
      healthy: false,
      configured: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return checks;
}

function printHealthReport(checks: HealthCheckResult[]): void {
  console.log("📊 Health Check Results:\n");
  console.log("=".repeat(60));

  let allHealthy = true;
  let configuredServices = 0;
  let healthyServices = 0;

  checks.forEach(check => {
    const statusIcon = check.healthy ? "✅" : "❌";
    const configIcon = check.configured ? "🔧" : "⚠️";

    console.log(`${statusIcon} ${configIcon} ${check.service}`);

    if (check.configured) configuredServices++;
    if (check.healthy) healthyServices++;
    if (!check.healthy) allHealthy = false;

    if (check.error) {
      console.log(`   Error: ${check.error}`);
    }

    if (check.details) {
      Object.entries(check.details).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }

    console.log();
  });

  console.log("=".repeat(60));
  console.log(`📈 Summary: ${healthyServices}/${checks.length} services healthy`);
  console.log(`🔧 Configuration: ${configuredServices}/${checks.length} services configured`);
  console.log(`🚀 Overall Status: ${allHealthy ? "HEALTHY" : "DEGRADED"}`);

  if (!allHealthy) {
    console.log(
      "\n⚠️  Some services are unhealthy. Check the errors above and your configuration."
    );
    process.exit(1);
  } else {
    console.log("\n🎉 All services are healthy and ready!");
  }
}

async function getSystemMetrics(): Promise<void> {
  try {
    console.log("\n📊 System Metrics:\n");
    console.log("-".repeat(40));

    // Get lead metrics
    const leadMetrics = await storage.getLeadMetrics();
    console.log("Lead Pipeline:");
    console.log(`  Total Visitors: ${leadMetrics.totalVisitors}`);
    console.log(`  Abandoned: ${leadMetrics.abandoned}`);
    console.log(`  Contacted: ${leadMetrics.contacted}`);
    console.log(`  PII Complete: ${leadMetrics.piiComplete}`);
    console.log(`  Submitted: ${leadMetrics.submitted}`);
    console.log(`  Accepted: ${leadMetrics.accepted}`);

    // Calculate conversion rates
    if (leadMetrics.totalVisitors > 0) {
      const abandonmentRate = ((leadMetrics.abandoned / leadMetrics.totalVisitors) * 100).toFixed(
        2
      );
      console.log(`  Abandonment Rate: ${abandonmentRate}%`);
    }

    if (leadMetrics.abandoned > 0) {
      const recoveryRate = ((leadMetrics.contacted / leadMetrics.abandoned) * 100).toFixed(2);
      console.log(`  Recovery Rate: ${recoveryRate}%`);
    }

    if (leadMetrics.contacted > 0) {
      const conversionRate = ((leadMetrics.piiComplete / leadMetrics.contacted) * 100).toFixed(2);
      console.log(`  Conversion Rate: ${conversionRate}%`);
    }

    // Get outreach stats
    const outreachStats = await outreachOrchestrator.getOutreachStats();
    console.log("\nOutreach Statistics:");
    console.log(`  Total Sent: ${outreachStats.totalSent}`);
    console.log(`  Sent Today: ${outreachStats.sentToday}`);
    console.log(`  Response Rate: ${outreachStats.responseRate.toFixed(2)}%`);

    // Get abandonment stats
    const abandonmentStats = await abandonmentDetector.getAbandonmentStats();
    console.log("\nAbandonment Breakdown:");
    abandonmentStats.byStep.forEach(step => {
      console.log(`  Step ${step.step}: ${step.count} visitors`);
    });
  } catch (error) {
    console.log(
      `\n❌ Failed to get system metrics: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// Main execution
async function main() {
  try {
    console.log("🚀 CCL MVP Automation Pipeline Health Check\n");
    console.log(`Environment: ${config.get().NODE_ENV}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    const checks = await runHealthChecks();
    printHealthReport(checks);
    await getSystemMetrics();
  } catch (error) {
    console.error("❌ Health check failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { runHealthChecks, printHealthReport };
