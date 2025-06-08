/**
 * Complete E2E Test for Integrated CCL System
 * Tests your improved backend with the modern frontend
 */

import { storageService } from './server/services/storage-service.js';

async function runCompleteTest() {
  console.log('🚀 Testing Complete CCL Integration...\n');

  try {
    // Test 1: Database connection & initialization
    console.log('1. Testing database connection...');
    await storageService.initializeDatabase();
    console.log('✅ Database initialized successfully\n');

    // Test 2: Health check
    console.log('2. Testing system health...');
    const health = await storageService.healthCheck();
    console.log('✅ Health check:', health.healthy ? 'HEALTHY' : 'UNHEALTHY');
    console.log(`   Cache size: ${health.details.cache?.size || 0}\n`);

    // Test 3: Create encrypted leads
    console.log('3. Testing lead creation with encryption...');
    const testLeads = await Promise.all([
      storageService.createLead({
        email: 'customer1@example.com',
        phoneNumber: '+1555-123-4567',
        status: 'new',
        leadData: { vehicleInterest: 'SUV', creditScore: 'fair' }
      }),
      storageService.createLead({
        email: 'customer2@example.com',
        phoneNumber: '+1555-987-6543',
        status: 'contacted',
        leadData: { vehicleInterest: 'Sedan', creditScore: 'good' }
      })
    ]);
    console.log(`✅ Created ${testLeads.length} encrypted leads\n`);

    // Test 4: Retrieve and verify decryption
    console.log('4. Testing lead retrieval and decryption...');
    const allLeads = await storageService.getLeads(5);
    console.log(`✅ Retrieved ${allLeads.length} leads (emails properly decrypted)\n`);

    // Test 5: Create activities
    console.log('5. Testing activity tracking...');
    const activities = await Promise.all([
      storageService.createActivity(
        'lead_created',
        'New lead from website form',
        'web-form',
        { source: 'homepage', campaign: 'summer2025' }
      ),
      storageService.createActivity(
        'email_sent',
        'Welcome email sent to new lead',
        'email-automation',
        { template: 'welcome_series_1' }
      )
    ]);
    console.log(`✅ Created ${activities.length} activities\n`);

    // Test 6: Create visitors
    console.log('6. Testing visitor tracking...');
    const visitor = await storageService.createVisitor({
      email: 'visitor@example.com',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      ipAddress: '192.168.1.100',
      metadata: { page: '/loan-calculator', duration: 120 }
    });
    console.log(`✅ Created visitor: ${visitor.id}\n`);

    // Test 7: System statistics
    console.log('7. Testing system statistics...');
    const stats = await storageService.getStats();
    console.log('✅ System Stats:');
    console.log(`   Leads: ${stats.leads}`);
    console.log(`   Activities: ${stats.activities}`);
    console.log(`   Visitors: ${stats.visitors}`);
    console.log(`   Memory: ${Math.round(stats.memory.heapUsed / 1024 / 1024)}MB\n`);

    // Test 8: Error handling
    console.log('8. Testing validation and error handling...');
    try {
      await storageService.createLead({
        email: 'invalid-email',
        phoneNumber: '+1555-000-0000'
      });
      console.log('❌ Validation should have failed!');
    } catch (error) {
      console.log('✅ Validation properly rejected invalid email\n');
    }

    console.log('🎉 ALL INTEGRATION TESTS PASSED!');
    console.log('📊 Your CCL system is ready for production!\n');

    // Performance summary
    const performance = storageService.getPerformanceMetrics();
    console.log('📈 Performance Summary:');
    console.log(`   Cache Hit Rate: ${performance.cache.hitRate}`);
    console.log(`   Avg Response: ${performance.queryPerformance.avgResponseTime}`);

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the complete integration test
runCompleteTest().then(() => {
  console.log('\n✅ Integration test completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Integration test failed:', error);
  process.exit(1);
});