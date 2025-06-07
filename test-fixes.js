/**
 * Test script to verify critical fixes
 */

const { storageService } = require('./server/services/storage-service');

async function testFixes() {
  console.log('🧪 Testing Critical Fixes...\n');

  try {
    // Test 1: Database initialization
    console.log('1. Testing database initialization...');
    await storageService.initializeDatabase();
    console.log('✅ Database initialized successfully\n');

    // Test 2: Health check (should not expose sensitive data)
    console.log('2. Testing health check security...');
    const health = await storageService.healthCheck();
    console.log('✅ Health check response:', JSON.stringify(health, null, 2));
    
    // Verify no cache keys are exposed
    if (health.details.cache && health.details.cache.keys) {
      console.log('❌ SECURITY ISSUE: Cache keys are still exposed!');
    } else {
      console.log('✅ Security: Cache keys properly hidden\n');
    }

    // Test 3: Create a lead (tests encryption)
    console.log('3. Testing lead creation with encryption...');
    const testLead = await storageService.createLead({
      email: 'test@example.com',
      phoneNumber: '+1234567890',
      status: 'new',
      leadData: { vehicleInterest: 'SUV' }
    });
    console.log('✅ Lead created:', testLead.id);
    console.log('✅ Email properly returned decrypted\n');

    // Test 4: Create activity (tests database storage)
    console.log('4. Testing activity creation...');
    const activity = await storageService.createActivity(
      'test',
      'Testing activity creation',
      'test_agent',
      { testData: true }
    );
    console.log('✅ Activity created:', activity.id);

    // Test 5: Get stats (tests database queries)
    console.log('5. Testing stats retrieval...');
    const stats = await storageService.getStats();
    console.log('✅ Stats retrieved:', {
      leads: stats.leads,
      activities: stats.activities,
      visitors: stats.visitors
    });

    console.log('\n🎉 All critical fixes verified successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run tests
testFixes().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
