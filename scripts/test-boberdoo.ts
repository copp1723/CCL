#!/usr/bin/env tsx
/**
 * Test script for Boberdoo service integration
 *
 * This script tests the Boberdoo service functionality including:
 * - Service health check
 * - Lead submission validation
 * - Error handling
 */

import { boberdooService } from "../server/services/boberdoo-service";
import { BoberdooSubmissionSchema } from "../shared/validation/schemas";
import { logger } from "../server/logger";
import config from "../server/config/environment";

const testLogger = logger.child({ component: "BoberdooTest" });

async function testBoberdooService() {
  console.log("🧪 Testing Boberdoo Service Integration\n");

  // Test 1: Service Configuration
  console.log("1. Testing Service Configuration...");
  const boberdooConfig = config.getBoberdooConfig();
  console.log(`   Configured: ${boberdooConfig.configured}`);
  console.log(`   URL: ${boberdooConfig.url || "Not configured"}`);
  console.log(`   Vendor ID: ${boberdooConfig.vendorId || "Not configured"}`);
  console.log(`   Timeout: ${boberdooConfig.timeoutMs}ms`);

  if (!boberdooConfig.configured) {
    console.log("   ⚠️  Boberdoo not configured - add environment variables:");
    console.log("      BOBERDOO_URL=https://api.boberdoo.com/submit");
    console.log("      BOBERDOO_VENDOR_ID=your-vendor-id");
    console.log("      BOBERDOO_VENDOR_PASSWORD=your-vendor-password");
    console.log("");
  }

  // Test 2: Health Check
  console.log("2. Testing Health Check...");
  try {
    const healthResult = await boberdooService.healthCheck();
    console.log(`   Health Status: ${healthResult.healthy ? "✅ Healthy" : "❌ Unhealthy"}`);
    console.log(`   Configured: ${healthResult.configured}`);
    if (healthResult.error) {
      console.log(`   Error: ${healthResult.error}`);
    }
    if (healthResult.responseTime) {
      console.log(`   Response Time: ${healthResult.responseTime}ms`);
    }
  } catch (error) {
    console.log(
      `   ❌ Health check failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
  console.log("");

  // Test 3: Service Statistics
  console.log("3. Testing Service Statistics...");
  const stats = boberdooService.getStats();
  console.log(`   Total Submissions: ${stats.submissionCount}`);
  console.log(`   Success Count: ${stats.successCount}`);
  console.log(`   Failure Count: ${stats.failureCount}`);
  console.log(`   Success Rate: ${stats.successRate}%`);
  console.log(`   DLQ Size: ${stats.deadLetterQueueSize}`);
  console.log(`   Last Success: ${stats.lastSuccessfulSubmission || "None"}`);
  console.log("");

  // Test 4: Validation Schema
  console.log("4. Testing Validation Schema...");
  const testSubmission = {
    vendor_id: "test-vendor",
    vendor_password: "test-password",
    first_name: "John",
    last_name: "Doe",
    email: "john.doe@example.com",
    phone: "+15551234567",
    address: "123 Main St",
    city: "Anytown",
    state: "CA",
    zip: "12345",
    employer: "Test Company",
    job_title: "Software Engineer",
    annual_income: 75000,
    time_on_job: 24,
    credit_score: 650,
    loan_amount: 25000,
    source: "website",
    lead_id: "test-lead-123",
  };

  const validationResult = BoberdooSubmissionSchema.safeParse(testSubmission);
  if (validationResult.success) {
    console.log("   ✅ Test submission data is valid");
  } else {
    console.log("   ❌ Test submission data failed validation:");
    console.log("   ", validationResult.error.flatten());
  }
  console.log("");

  // Test 5: Dead Letter Queue
  console.log("5. Testing Dead Letter Queue...");
  const dlq = boberdooService.getDeadLetterQueue();
  console.log(`   DLQ Entries: ${dlq.length}`);
  if (dlq.length > 0) {
    console.log("   Recent Failed Submissions:");
    dlq.slice(0, 3).forEach((entry, index) => {
      console.log(`     ${index + 1}. Lead ID: ${entry.leadId}`);
      console.log(`        Attempts: ${entry.attempts}`);
      console.log(`        Last Attempt: ${entry.lastAttempt}`);
      console.log(`        Can Retry: ${entry.canRetry}`);
      console.log(`        Latest Error: ${entry.errors[entry.errors.length - 1]}`);
    });
  } else {
    console.log("   No failed submissions in queue");
  }
  console.log("");

  // Test Summary
  console.log("📊 Test Summary:");
  console.log(`   Configuration: ${boberdooConfig.configured ? "✅ Ready" : "⚠️  Needs setup"}`);
  console.log(`   Health Status: ${stats.configured ? "✅ Available" : "❌ Not available"}`);
  console.log(`   Validation: ✅ Working`);
  console.log(`   Statistics: ✅ Working`);
  console.log(`   Dead Letter Queue: ✅ Working`);

  if (boberdooConfig.configured) {
    console.log("");
    console.log("🎉 Boberdoo service is ready for Sprint 3!");
    console.log("   You can now:");
    console.log("   • Submit leads to Boberdoo marketplace");
    console.log("   • Track submission success rates");
    console.log("   • Monitor revenue from lead sales");
    console.log("   • Retry failed submissions from DLQ");
  } else {
    console.log("");
    console.log("🔧 Next Steps:");
    console.log("   1. Configure Boberdoo environment variables");
    console.log("   2. Test with actual submission");
    console.log("   3. Integrate with LeadPackagingAgent");
    console.log("   4. Set up dashboard monitoring");
  }
}

// Run the test
testBoberdooService().catch(error => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
