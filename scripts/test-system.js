#!/usr/bin/env node

import SystemValidator from "../tests/system-validation.test.js";

async function runSystemTests() {
  console.log("🔧 Complete Car Loans System Validation");
  console.log("=".repeat(40));
  
  // Wait a moment for the server to be ready
  console.log("Waiting for server to be ready...");
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const validator = new SystemValidator();
  await validator.runAllTests();
  
  process.exit(validator.failed > 0 ? 1 : 0);
}

runSystemTests().catch(error => {
  console.error("System test runner failed:", error);
  process.exit(1);
});
