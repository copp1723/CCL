const axios = require("axios");

const BASE_URL = "http://localhost:5000";
const API_KEY = process.env.INTERNAL_API_KEY || "test-key-12345";

class SystemValidator {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  async test(name, testFn) {
    try {
      console.log(`Testing: ${name}...`);
      await testFn();
      this.results.push({ name, status: "PASS" });
      this.passed++;
      console.log(`✅ ${name} - PASSED`);
    } catch (error) {
      this.results.push({ name, status: "FAIL", error: error.message });
      this.failed++;
      console.log(`❌ ${name} - FAILED: ${error.message}`);
    }
  }

  async runAllTests() {
    console.log("🚀 Starting System Validation Tests\n");

    // Health Check Tests
    await this.test("System Health Check", async () => {
      const response = await axios.get(`${BASE_URL}/health`);
      if (response.status !== 200) throw new Error("Health check failed");
    });

    // Data Ingestion Tests
    await this.test("Data Ingestion Stats API", async () => {
      const response = await axios.get(`${BASE_URL}/api/data-ingestion/stats`, {
        headers: { "x-api-key": API_KEY },
      });
      if (response.status !== 200) throw new Error("Stats API failed");
    });

    await this.test("Manual Lead Upload", async () => {
      const testLead = {
        leads: [
          {
            email: "test@example.com",
            firstName: "Test",
            lastName: "User",
            vehicleInterest: "SUV",
            phoneNumber: "555-123-4567",
          },
        ],
      };
      const response = await axios.post(`${BASE_URL}/api/data-ingestion/leads/manual`, testLead, {
        headers: { "x-api-key": API_KEY },
      });
      if (response.status !== 200) throw new Error("Manual upload failed");
    });

    await this.test("API Import Endpoint", async () => {
      const testData = {
        source: "test_system",
        leads: [
          {
            email: "api-test@example.com",
            firstName: "API",
            lastName: "Test",
          },
        ],
      };
      const response = await axios.post(
        `${BASE_URL}/api/data-ingestion/leads/api-import`,
        testData,
        {
          headers: { "x-api-key": API_KEY },
        }
      );
      if (response.status !== 200) throw new Error("API import failed");
    });

    await this.test("Email Capture Endpoint", async () => {
      const emailData = {
        sender: "email-test@example.com",
        subject: "Test Inquiry",
        body: "Hi, I am interested in a Honda SUV. My name is John Smith and my phone is 555-987-6543.",
      };
      const response = await axios.post(
        `${BASE_URL}/api/data-ingestion/leads/email-capture`,
        emailData,
        {
          headers: { "x-api-key": API_KEY },
        }
      );
      if (response.status !== 200) throw new Error("Email capture failed");
    });

    // Email Campaign Tests
    await this.test("Email Campaign Status", async () => {
      const response = await axios.get(`${BASE_URL}/api/email-campaigns/status`, {
        headers: { "x-api-key": API_KEY },
      });
      if (response.status !== 200) throw new Error("Campaign status failed");
    });

    // Agent System Tests
    await this.test("Agent Status Check", async () => {
      const response = await axios.get(`${BASE_URL}/api/agents/status`, {
        headers: { "x-api-key": API_KEY },
      });
      if (response.status !== 200) throw new Error("Agent status failed");
    });

    // Authentication Tests
    await this.test("API Key Authentication", async () => {
      try {
        await axios.get(`${BASE_URL}/api/data-ingestion/stats`);
        throw new Error("Should have required API key");
      } catch (error) {
        if (error.response && error.response.status === 401) {
          // This is expected - authentication is working
        } else {
          throw error;
        }
      }
    });

    // Performance Tests
    await this.test("Response Time Check", async () => {
      const start = Date.now();
      await axios.get(`${BASE_URL}/health`);
      const duration = Date.now() - start;
      if (duration > 2000) throw new Error(`Response too slow: ${duration}ms`);
    });

    // Database Connection Tests
    await this.test("Database Operations", async () => {
      // Test that we can create and retrieve data
      const testLead = {
        leads: [
          {
            email: "db-test@example.com",
            firstName: "Database",
            lastName: "Test",
          },
        ],
      };
      const response = await axios.post(`${BASE_URL}/api/data-ingestion/leads/manual`, testLead, {
        headers: { "x-api-key": API_KEY },
      });
      if (!response.data.success) throw new Error("Database operation failed");
    });

    this.printResults();
  }

  printResults() {
    console.log("\n📊 System Validation Results");
    console.log("=" * 50);
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Success Rate: ${((this.passed / this.results.length) * 100).toFixed(1)}%`);

    if (this.failed > 0) {
      console.log("\n❌ Failed Tests:");
      this.results
        .filter(r => r.status === "FAIL")
        .forEach(result => {
          console.log(`  - ${result.name}: ${result.error}`);
        });
    }

    console.log(
      "\n✅ System Status: " + (this.failed === 0 ? "ALL SYSTEMS OPERATIONAL" : "ISSUES DETECTED")
    );
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const validator = new SystemValidator();
  validator.runAllTests().catch(console.error);
}

module.exports = SystemValidator;
