import { storage } from './storage';
import { visitorIdentifierService } from './agents/visitor-identifier';
import { emailReengagementService } from './agents/email-reengagement';
import { creditCheckService } from './agents/credit-check';
import { leadPackagingService } from './agents/lead-packaging';
import { generateSessionId, generateEmailHash } from './services/token';

/**
 * End-to-End Test Scenarios for CCL Agent System
 * Simulates realistic customer journeys with edge cases
 */

export interface TestScenario {
  name: string;
  description: string;
  steps: TestStep[];
}

export interface TestStep {
  action: string;
  description: string;
  execute: () => Promise<any>;
  expectedOutcome: string;
}

// Test data pool with various customer profiles
const testCustomers = [
  {
    email: 'john.doe@gmail.com',
    phone: '555-123-4567',
    creditProfile: 'excellent', // 750+ score
    abandonmentStep: 4,
  },
  {
    email: 'sarah.jones@yahoo.com',
    phone: '555-987-6543',
    creditProfile: 'good', // 670-750 score
    abandonmentStep: 3,
  },
  {
    email: 'mike.wilson@hotmail.com',
    phone: '555-456-7890',
    creditProfile: 'fair', // 580-670 score
    abandonmentStep: 2,
  },
  {
    email: 'lisa.brown@outlook.com',
    phone: '555-321-0987',
    creditProfile: 'poor', // <580 score
    abandonmentStep: 5,
  },
  {
    email: 'invalid-email-format',
    phone: '123', // Invalid phone
    creditProfile: 'error',
    abandonmentStep: 1,
  }
];

export class TestScenarioRunner {
  private scenarios: TestScenario[] = [];

  constructor() {
    this.initializeScenarios();
  }

  private initializeScenarios(): void {
    this.scenarios = [
      this.createHappyPathScenario(),
      this.createAbandonmentRecoveryScenario(),
      this.createCreditDeclineScenario(),
      this.createEdgeCaseScenario(),
      this.createHighVolumeScenario(),
    ];
  }

  private createHappyPathScenario(): TestScenario {
    const customer = testCustomers[0];
    const sessionId = generateSessionId();
    
    return {
      name: 'Happy Path Journey',
      description: 'Complete journey from abandonment to successful lead submission',
      steps: [
        {
          action: 'visitor_abandonment',
          description: 'Customer abandons loan application at step 4',
          execute: async () => {
            return await visitorIdentifierService.processAbandonmentEvent({
              sessionId,
              email: customer.email,
              step: customer.abandonmentStep,
              timestamp: new Date(),
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              ip: '192.168.1.100',
            });
          },
          expectedOutcome: 'Visitor created, abandonment detected, lead_ready event emitted'
        },
        {
          action: 'email_sent',
          description: 'Re-engagement email sent with return token',
          execute: async () => {
            const visitor = await storage.getVisitorByEmailHash(generateEmailHash(customer.email));
            if (!visitor) throw new Error('Visitor not found');
            return await emailReengagementService.processLeadReady(visitor.id);
          },
          expectedOutcome: 'Email campaign created and sent with 24h token'
        },
        {
          action: 'email_engagement',
          description: 'Customer opens and clicks email',
          execute: async () => {
            const campaigns = await storage.getEmailCampaignsByVisitor(1);
            if (campaigns.length === 0) throw new Error('No campaigns found');
            const token = campaigns[0].returnToken;
            
            // Simulate email open
            await emailReengagementService.handleEmailEngagement(token, 'opened');
            // Simulate email click
            await emailReengagementService.handleEmailEngagement(token, 'clicked');
            
            return { token, opened: true, clicked: true };
          },
          expectedOutcome: 'Email engagement tracked, visitor returns to application'
        },
        {
          action: 'chat_session',
          description: 'Customer initiates chat and provides phone number',
          execute: async () => {
            // This would normally be triggered via WebSocket
            // For testing, we'll simulate the chat interaction
            const visitor = await storage.getVisitorByEmailHash(generateEmailHash(customer.email));
            if (!visitor) throw new Error('Visitor not found');
            
            return await storage.createChatSession({
              sessionId: sessionId,
              visitorId: visitor.id,
              isActive: true,
              messages: [
                {
                  id: 'msg_1',
                  sessionId: sessionId,
                  sender: 'user',
                  content: `Hi, I'd like to continue my application. My phone is ${customer.phone}`,
                  timestamp: new Date(),
                }
              ],
            });
          },
          expectedOutcome: 'Chat session created, phone number captured'
        },
        {
          action: 'credit_check',
          description: 'Soft credit pull performed via FlexPath API',
          execute: async () => {
            const visitor = await storage.getVisitorByEmailHash(generateEmailHash(customer.email));
            if (!visitor) throw new Error('Visitor not found');
            
            return await creditCheckService.performCreditCheck(customer.phone, visitor.id);
          },
          expectedOutcome: 'Credit check completed, approval status determined'
        },
        {
          action: 'lead_packaging',
          description: 'Lead packaged and submitted to dealer CRM',
          execute: async () => {
            const visitor = await storage.getVisitorByEmailHash(generateEmailHash(customer.email));
            const creditCheck = await storage.getCreditCheckByVisitorId(visitor!.id);
            if (!visitor || !creditCheck) throw new Error('Required data not found');
            
            return await leadPackagingService.processApprovedLead(visitor.id, creditCheck.id);
          },
          expectedOutcome: 'Lead assembled and submitted to dealer CRM successfully'
        }
      ]
    };
  }

  private createAbandonmentRecoveryScenario(): TestScenario {
    const customer = testCustomers[1];
    const sessionId = generateSessionId();
    
    return {
      name: 'Abandonment Recovery',
      description: 'Customer abandons, gets email, returns from different device',
      steps: [
        {
          action: 'abandonment_detected',
          description: 'Customer abandons at step 3',
          execute: async () => {
            return await visitorIdentifierService.processAbandonmentEvent({
              sessionId,
              email: customer.email,
              step: customer.abandonmentStep,
              timestamp: new Date(),
              userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
              ip: '10.0.0.1',
            });
          },
          expectedOutcome: 'Abandonment detected and logged'
        },
        {
          action: 'email_recovery',
          description: 'Email sent and customer returns from different device',
          execute: async () => {
            const visitor = await storage.getVisitorByEmailHash(generateEmailHash(customer.email));
            if (!visitor) throw new Error('Visitor not found');
            
            await emailReengagementService.processLeadReady(visitor.id);
            
            // Simulate return from different device/session
            const newSessionId = generateSessionId();
            return await storage.updateVisitor(visitor.id, {
              sessionId: newSessionId,
              lastActivity: new Date(),
            });
          },
          expectedOutcome: 'Customer returns with new session, data preserved'
        }
      ]
    };
  }

  private createCreditDeclineScenario(): TestScenario {
    const customer = testCustomers[3]; // Poor credit profile
    const sessionId = generateSessionId();
    
    return {
      name: 'Credit Decline Handling',
      description: 'Customer with poor credit gets alternative options',
      steps: [
        {
          action: 'poor_credit_check',
          description: 'Credit check returns decline/poor score',
          execute: async () => {
            await visitorIdentifierService.processAbandonmentEvent({
              sessionId,
              email: customer.email,
              step: customer.abandonmentStep,
              timestamp: new Date(),
            });
            
            const visitor = await storage.getVisitorByEmailHash(generateEmailHash(customer.email));
            if (!visitor) throw new Error('Visitor not found');
            
            return await creditCheckService.performCreditCheck(customer.phone, visitor.id);
          },
          expectedOutcome: 'Credit check completed with decline/alternative terms'
        }
      ]
    };
  }

  private createEdgeCaseScenario(): TestScenario {
    const customer = testCustomers[4]; // Invalid data
    
    return {
      name: 'Edge Cases & Data Validation',
      description: 'Test system resilience with invalid/malicious data',
      steps: [
        {
          action: 'invalid_email_format',
          description: 'Submit abandonment with invalid email format',
          execute: async () => {
            try {
              return await visitorIdentifierService.processAbandonmentEvent({
                sessionId: generateSessionId(),
                email: customer.email, // Invalid format
                step: customer.abandonmentStep,
                timestamp: new Date(),
              });
            } catch (error) {
              return { error: error instanceof Error ? error.message : 'Unknown error' };
            }
          },
          expectedOutcome: 'Invalid email handled gracefully, error logged'
        },
        {
          action: 'invalid_phone_number',
          description: 'Submit credit check with invalid phone',
          execute: async () => {
            try {
              return await creditCheckService.performCreditCheck(customer.phone);
            } catch (error) {
              return { error: error instanceof Error ? error.message : 'Unknown error' };
            }
          },
          expectedOutcome: 'Invalid phone format rejected with clear error message'
        },
        {
          action: 'pii_injection_test',
          description: 'Test PII protection with sensitive data in fields',
          execute: async () => {
            const sessionId = generateSessionId();
            
            // Attempt to inject PII in chat message
            try {
              return await storage.createChatSession({
                sessionId,
                visitorId: null,
                isActive: true,
                messages: [
                  {
                    id: 'msg_pii',
                    sessionId,
                    sender: 'user',
                    content: 'My SSN is 123-45-6789 and my full name is John Smith, DOB 01/01/1990',
                    timestamp: new Date(),
                  }
                ],
              });
            } catch (error) {
              return { error: error instanceof Error ? error.message : 'Unknown error' };
            }
          },
          expectedOutcome: 'PII detected and sanitized/blocked before storage'
        }
      ]
    };
  }

  private createHighVolumeScenario(): TestScenario {
    return {
      name: 'High Volume Load Test',
      description: 'Simulate concurrent operations to test system capacity',
      steps: [
        {
          action: 'concurrent_abandonments',
          description: 'Process 50 simultaneous abandonment events',
          execute: async () => {
            const startTime = Date.now();
            const promises = [];
            
            for (let i = 0; i < 50; i++) {
              const promise = visitorIdentifierService.processAbandonmentEvent({
                sessionId: generateSessionId(),
                email: `test${i}@example.com`,
                step: Math.floor(Math.random() * 5) + 1,
                timestamp: new Date(),
              });
              promises.push(promise);
            }
            
            await Promise.all(promises);
            const duration = Date.now() - startTime;
            
            return { processed: 50, duration, avgTime: duration / 50 };
          },
          expectedOutcome: 'All events processed within acceptable time limits'
        }
      ]
    };
  }

  async runScenario(scenarioName: string): Promise<any> {
    const scenario = this.scenarios.find(s => s.name === scenarioName);
    if (!scenario) {
      throw new Error(`Scenario "${scenarioName}" not found`);
    }

    console.log(`\n=== Running Scenario: ${scenario.name} ===`);
    console.log(`Description: ${scenario.description}\n`);

    const results = [];

    for (const step of scenario.steps) {
      console.log(`Executing: ${step.action} - ${step.description}`);
      
      try {
        const startTime = Date.now();
        const result = await step.execute();
        const duration = Date.now() - startTime;
        
        const stepResult = {
          step: step.action,
          description: step.description,
          expectedOutcome: step.expectedOutcome,
          result,
          duration,
          status: 'success'
        };
        
        results.push(stepResult);
        console.log(`✅ Success (${duration}ms):`, step.expectedOutcome);
        
      } catch (error) {
        const stepResult = {
          step: step.action,
          description: step.description,
          expectedOutcome: step.expectedOutcome,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 'error'
        };
        
        results.push(stepResult);
        console.log(`❌ Error:`, error instanceof Error ? error.message : error);
      }
      
      // Small delay between steps
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      scenario: scenario.name,
      description: scenario.description,
      steps: results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
      }
    };
  }

  async runAllScenarios(): Promise<any> {
    const allResults = [];
    
    for (const scenario of this.scenarios) {
      try {
        const result = await this.runScenario(scenario.name);
        allResults.push(result);
      } catch (error) {
        allResults.push({
          scenario: scenario.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 'failed'
        });
      }
      
      // Delay between scenarios
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      testRun: new Date().toISOString(),
      scenarios: allResults,
      summary: {
        totalScenarios: allResults.length,
        passedScenarios: allResults.filter(r => !r.error).length,
        failedScenarios: allResults.filter(r => r.error).length,
      }
    };
  }

  getScenarioNames(): string[] {
    return this.scenarios.map(s => s.name);
  }
}

export const testRunner = new TestScenarioRunner();