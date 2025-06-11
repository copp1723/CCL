#!/usr/bin/env tsx
/**
 * Test SMS Service Script
 *
 * This script tests the Twilio SMS service with various scenarios
 */

import { twilioSms } from "../server/services/twilio-sms";
import { storage } from "../server/storage";
import config from "../server/config/environment";

async function testSmsService() {
  console.log("🧪 Testing Twilio SMS Service...\n");

  // Check if Twilio is configured
  const twilioInfo = twilioSms.getServiceInfo();
  if (!twilioInfo.configured) {
    console.log("❌ Twilio SMS is not configured. Please check your environment variables:");
    console.log("   - TWILIO_ACCOUNT_SID");
    console.log("   - TWILIO_AUTH_TOKEN");
    console.log("   - OUTBOUND_PHONE_NUMBER");
    return;
  }

  console.log("✅ Twilio SMS is configured");
  console.log(`   Account SID: ${twilioInfo.accountSid}`);
  console.log(`   Outbound Number: ${twilioInfo.outboundNumber}`);

  // Test health check
  console.log("\n🔍 Testing Twilio connection...");
  const healthCheck = await twilioSms.healthCheck();
  if (healthCheck.healthy) {
    console.log("✅ Twilio connection is healthy");
  } else {
    console.log(`❌ Twilio connection failed: ${healthCheck.error}`);
    return;
  }

  // Test phone number validation
  console.log("\n📞 Testing phone number validation...");
  const testNumbers = [
    "+15551234567",
    "(555) 123-4567",
    "5551234567",
    "15551234567",
    "+1-555-123-4567",
    "invalid-number",
  ];

  testNumbers.forEach(number => {
    const isValid = twilioSms.isValidPhoneNumber(number);
    console.log(`   ${number}: ${isValid ? "✅" : "❌"}`);
  });

  // Test SMS segment estimation
  console.log("\n📝 Testing SMS segment estimation...");
  const testMessages = [
    "Short message",
    "This is a longer message that might take more than one SMS segment to send to the customer",
    "A" * 200, // Long message
    "🎉 Message with emojis 📱💬", // Unicode message
  ];

  testMessages.forEach(message => {
    const segments = twilioSms.estimateSmsSegments(message);
    console.log(`   "${message.substring(0, 50)}${message.length > 50 ? "..." : ""}"`);
    console.log(`   Length: ${message.length} chars, Segments: ${segments}`);
  });

  // Optionally send a test SMS (only if TEST_PHONE_NUMBER is provided)
  const testPhoneNumber = process.env.TEST_PHONE_NUMBER;
  if (testPhoneNumber) {
    console.log("\n📤 Sending test SMS...");
    try {
      const result = await twilioSms.sendSms({
        to: testPhoneNumber,
        message:
          "This is a test message from CCL MVP Automation Pipeline. If you received this, the SMS service is working correctly!",
        priority: "normal",
      });

      if (result.success) {
        console.log("✅ Test SMS sent successfully!");
        console.log(`   Message ID: ${result.messageId}`);
        console.log(`   Segments: ${result.segments}`);
        console.log(`   Cost: $${result.cost || "Unknown"}`);
      } else {
        console.log(`❌ Test SMS failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ Test SMS error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else {
    console.log("\n💡 To test SMS sending, set TEST_PHONE_NUMBER environment variable");
    console.log("   Example: TEST_PHONE_NUMBER=+15551234567 npm run test:sms");
  }

  console.log("\n🎉 SMS service test completed!");
}

// Test with a mock visitor
async function testRecoveryMessage() {
  console.log("\n🔄 Testing recovery message generation...");

  const mockVisitor = {
    id: 999,
    firstName: "John",
    lastName: "Doe",
    phoneNumber: "+15551234567",
    returnToken: "test-token-123",
    returnTokenExpiry: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
    abandonmentStep: 1,
    email: null,
    emailHash: null,
    sessionId: "test-session",
    ipAddress: null,
    userAgent: null,
    metadata: null,
    lastActivity: new Date(),
    abandonmentDetected: true,
    createdAt: new Date(),
    // Add other required fields with defaults
    adClickTs: new Date(),
    formStartTs: null,
    formSubmitTs: null,
    ingestSource: "test",
    street: null,
    city: null,
    state: null,
    zip: null,
    employer: null,
    jobTitle: null,
    annualIncome: null,
    timeOnJobMonths: null,
    piiComplete: false,
    creditCheckStatus: null,
    creditScore: null,
    creditCheckDate: null,
  };

  for (let step = 1; step <= 3; step++) {
    console.log(`\n📨 Abandonment Step ${step} Message:`);
    mockVisitor.abandonmentStep = step;

    // This would normally send an SMS, but we'll just test the message generation
    // by simulating what the recovery message would look like
    const testPhoneNumber = process.env.TEST_PHONE_NUMBER;
    if (testPhoneNumber && twilioSms.getServiceInfo().configured) {
      try {
        const result = await twilioSms.sendRecoveryMessage(mockVisitor as any, step);
        if (result.success) {
          console.log(`   ✅ Recovery message sent for step ${step}`);
          console.log(`   Message ID: ${result.messageId}`);
        } else {
          console.log(`   ❌ Recovery message failed for step ${step}: ${result.error}`);
        }
      } catch (error) {
        console.log(
          `   ❌ Error sending recovery message: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    } else {
      console.log(`   💡 Would send recovery message for abandonment step ${step}`);
      console.log(`   To: ${mockVisitor.phoneNumber}`);
      console.log(`   Include return token: ${mockVisitor.returnToken}`);
    }
  }
}

async function main() {
  try {
    await testSmsService();
    await testRecoveryMessage();
  } catch (error) {
    console.error("❌ SMS test failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { testSmsService, testRecoveryMessage };
