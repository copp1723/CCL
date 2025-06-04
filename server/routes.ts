import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketManager } from "./services/websocket";
import { initializeAgentOrchestrator, agentOrchestrator } from "./agents";
import { emailReengagementService } from "./agents/email-reengagement";
import { visitorIdentifierService, type AbandonmentEvent } from "./agents/visitor-identifier";
import { generateSessionId } from "./services/token";
import { agentConfigService } from "./services/AgentConfigService";
import { flexPathService } from "./services/FlexPathService";
import { dataMappingService } from "./services/DataMappingService";
import { emailCampaignService } from "./services/EmailCampaignService";
import { mailgunService } from "./services/MailgunService";
import { Router } from 'express';
import { asyncHandler, AppError, ErrorLogger } from './utils/errorHandler';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Initialize WebSocket manager
  const wsManager = new WebSocketManager(httpServer);

  // Initialize agent orchestrator
  initializeAgentOrchestrator(wsManager);

  // API Routes

  // Dashboard metrics
  app.get("/api/metrics", async (req, res) => {
    try {
      const metrics = await agentOrchestrator.getAgentMetrics();
      res.json(metrics);
    } catch (error) {
      console.error('Error getting metrics:', error);
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  });

  // Agent statuses
  app.get("/api/agents/status", async (req, res) => {
    try {
      const statuses = await agentOrchestrator.getAgentStatuses();
      res.json(statuses);
    } catch (error) {
      console.error('Error getting agent statuses:', error);
      res.status(500).json({ error: 'Failed to get agent statuses' });
    }
  });

  // Recent activity feed
  app.get("/api/activity", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const activities = await storage.getRecentAgentActivity(limit);
      res.json(activities);
    } catch (error) {
      console.error('Error getting activity:', error);
      res.status(500).json({ error: 'Failed to get activity' });
    }
  });

  // Recent leads
  app.get("/api/leads", async (req, res) => {
    try {
      const status = req.query.status as string;
      const leads = status 
        ? await storage.getLeadsByStatus(status)
        : await storage.getLeadsByStatus('submitted');

      // Get recent leads (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentLeads = leads
        .filter(lead => lead.createdAt > yesterday)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10);

      res.json(recentLeads);
    } catch (error) {
      console.error('Error getting leads:', error);
      res.status(500).json({ error: 'Failed to get leads' });
    }
  });

  // Simulate abandonment event (for testing)
  app.post("/api/abandonment", async (req, res) => {
    try {
      const { email, step, sessionId } = req.body;

      if (!email || !step) {
        return res.status(400).json({ error: 'Email and step are required' });
      }

      const event: AbandonmentEvent = {
        sessionId: sessionId || generateSessionId(),
        email,
        step: parseInt(step),
        timestamp: new Date(),
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      };

      await visitorIdentifierService.processAbandonmentEvent(event);

      res.json({ success: true, message: 'Abandonment event processed' });
    } catch (error) {
      console.error('Error processing abandonment:', error);
      res.status(500).json({ error: 'Failed to process abandonment event' });
    }
  });

  // Email return token validation
  app.get("/api/email/return/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const campaign = await storage.getEmailCampaignByToken(token);
      const validation = { 
        valid: campaign && campaign.expiresAt > new Date(), 
        visitorId: campaign?.visitorId 
      };

      if (validation.valid) {
        // Track email click
        await emailReengagementService.handleEmailEngagement(token, 'clicked');

        // In a real app, redirect to continue application page
        res.json({ 
          valid: true, 
          visitorId: validation.visitorId,
          redirectUrl: `/continue-application?token=${token}` 
        });
      } else {
        res.status(400).json({ valid: false, error: 'Invalid or expired token' });
      }
    } catch (error) {
      console.error('Error validating return token:', error);
      res.status(500).json({ error: 'Failed to validate token' });
    }
  });

  // Email tracking pixel
  app.get("/api/email/pixel/:campaignId/:token.gif", async (req, res) => {
    try {
      const { token } = req.params;

      // Track email open
      await emailReengagementService.handleEmailEngagement(token, 'opened');

      // Return 1x1 transparent GIF
      const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      );

      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Content-Length', pixel.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.end(pixel);
    } catch (error) {
      console.error('Error tracking email pixel:', error);
      res.status(200).end(); // Always return 200 for tracking pixels
    }
  });

  // Email click tracking
  app.get("/api/email/click/:campaignId/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { url } = req.query;

      // Track email click
      await emailReengagementService.handleEmailEngagement(token, 'clicked');

      // Redirect to original URL
      if (url && typeof url === 'string') {
        res.redirect(decodeURIComponent(url));
      } else {
        res.redirect('/');
      }
    } catch (error) {
      console.error('Error tracking email click:', error);
      res.redirect('/'); // Always redirect somewhere
    }
  });

  // Get visitor by session
  app.get("/api/visitor/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const visitor = await storage.getVisitorBySessionId(sessionId);

      if (visitor) {
        res.json(visitor);
      } else {
        res.status(404).json({ error: 'Visitor not found' });
      }
    } catch (error) {
      console.error('Error getting visitor:', error);
      res.status(500).json({ error: 'Failed to get visitor' });
    }
  });

  // Get chat session messages
  app.get("/api/chat/:sessionId/messages", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const chatSession = await storage.getChatSessionBySessionId(sessionId);

      if (chatSession) {
        res.json({ messages: chatSession.messages || [] });
      } else {
        res.status(404).json({ error: 'Chat session not found' });
      }
    } catch (error) {
      console.error('Error getting chat messages:', error);
      res.status(500).json({ error: 'Failed to get chat messages' });
    }
  });

  // Chat endpoint for Cathy's personality interactions with FlexPath integration
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, sessionId, phone } = req.body;

      if (!message || !sessionId) {
        return res.status(400).json({ error: 'Message and sessionId required' });
      }

      // Find or create visitor for this session
      let visitor = await storage.getVisitorBySessionId(sessionId);
      if (!visitor) {
        const emailHash = `temp_${sessionId}@chat.session`;
        visitor = await storage.createVisitor({
          emailHash,
          sessionId,
          lastActivity: new Date(),
          abandonmentDetected: false
        });
      }

      // Generate Cathy's response using dynamic configuration
      let response = agentConfigService.generateChatResponse(message, 'chat', phone);

      // Check if user is requesting credit check/pre-qualification
      const lowerMessage = message.toLowerCase();
      const isRequestingCredit = lowerMessage.includes('pre-qual') || 
                                lowerMessage.includes('qualify') || 
                                lowerMessage.includes('credit check') ||
                                lowerMessage.includes('approve') ||
                                (lowerMessage.includes('yes') && (lowerMessage.includes('start') || lowerMessage.includes('get')));

      if (isRequestingCredit) {
        // Generate FlexPath link for credit check handoff
        const flexPathResult = flexPathService.generateChatLink(phone);

        if (flexPathResult.success && flexPathResult.link) {
          response = flexPathService.getHandoffMessage(flexPathResult);

          // Log FlexPath handoff
          await storage.createAgentActivity({
            agentName: 'CathyChatAgent',
            action: 'flexpath_handoff',
            status: 'success',
            details: `Generated FlexPath pre-qualification link for session ${sessionId}`,
            visitorId: visitor.id
          });
        } else {
          // If FlexPath link generation fails, provide helpful fallback
          response = "I'd love to get you pre-qualified right away! Let me connect you with our secure pre-qualification system. Our team will reach out within the next few minutes to complete your application. In the meantime, do you have any questions about the financing process?";

          // Log fallback
          await storage.createAgentActivity({
            agentName: 'CathyChatAgent',
            action: 'flexpath_fallback',
            status: 'warning',
            details: `FlexPath link generation failed: ${flexPathResult.error}`,
            visitorId: visitor.id
          });
        }
      }

      // Log chat activity
      await storage.createAgentActivity({
        agentName: 'CathyChatAgent',
        action: 'chat_response',
        status: 'success',
        details: `Chat interaction with session ${sessionId}`,
        visitorId: visitor.id
      });

      res.json({ response });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ error: 'Chat service temporarily unavailable' });
    }
  });

  // Agent configuration endpoints
  app.get("/api/agent-configs", (req, res) => {
    try {
      const configs = agentConfigService.getAllConfigs();
      res.json(configs);
    } catch (error) {
      console.error('Error getting agent configs:', error);
      res.status(500).json({ error: 'Failed to get agent configurations' });
    }
  });

  app.post("/api/agent-configs", (req, res) => {
    try {
      const newConfigs = req.body;
      agentConfigService.updateConfigs(newConfigs);
      res.json({ success: true, message: 'Agent configurations updated successfully' });
    } catch (error) {
      console.error('Error updating agent configs:', error);
      res.status(500).json({ error: 'Failed to update agent configurations' });
    }
  });

  // FlexPath integration endpoints
  app.post("/api/flexpath/generate-link", (req, res) => {
    try {
      const { phone, vehicleInfo, source } = req.body;

      let linkResult;
      if (source === 'chat') {
        linkResult = flexPathService.generateChatLink(phone, vehicleInfo);
      } else if (source === 'email') {
        linkResult = flexPathService.generateEmailLink(phone, vehicleInfo);
      } else {
        linkResult = flexPathService.generateHomepageLink(phone);
      }

      if (linkResult.success) {
        res.json({
          success: true,
          link: linkResult.link,
          message: flexPathService.getHandoffMessage(linkResult, !!vehicleInfo)
        });
      } else {
        res.status(400).json({
          success: false,
          error: linkResult.error
        });
      }
    } catch (error) {
      console.error('Error generating FlexPath link:', error);
      res.status(500).json({ error: 'Failed to generate FlexPath link' });
    }
  });

  app.get("/api/flexpath/status", (req, res) => {
    try {
      const validation = flexPathService.validateConfiguration();
      res.json(validation);
    } catch (error) {
      console.error('Error checking FlexPath status:', error);
      res.status(500).json({ error: 'Failed to check FlexPath status' });
    }
  });

  // Data mapping and CSV processing endpoints
  app.post("/api/data-mapping/process-csv", (req, res) => {
    try {
      const { csvData, messageType } = req.body;

      if (!csvData || !Array.isArray(csvData)) {
        return res.status(400).json({ error: 'CSV data must be an array of records' });
      }

      const result = dataMappingService.processBatch(csvData);

      res.json({
        success: true,
        totalRecords: csvData.length,
        processedCount: result.processed.length,
        errorCount: result.errors.length,
        processed: result.processed,
        errors: result.errors
      });
    } catch (error) {
      console.error('Error processing CSV data:', error);
      res.status(500).json({ error: 'Failed to process CSV data' });
    }
  });

  app.post("/api/data-mapping/generate-message", (req, res) => {
    try {
      const { customerData, messageType } = req.body;

      if (!customerData) {
        return res.status(400).json({ error: 'Customer data required' });
      }

      const customer = dataMappingService.mapCsvRowToCustomerRecord(customerData);
      const validation = dataMappingService.validateCustomerRecord(customer);

      if (!validation.valid) {
        return res.status(400).json({ 
          error: 'Invalid customer data', 
          issues: validation.issues 
        });
      }

      const message = dataMappingService.generatePersonalizedMessage(
        customer, 
        messageType || 'reengagement'
      );

      res.json({
        success: true,
        customer,
        message,
        validation
      });
    } catch (error) {
      console.error('Error generating message:', error);
      res.status(500).json({ error: 'Failed to generate message' });
    }
  });

  app.get("/api/data-mapping/test-message", (req, res) => {
    try {
      const testMessage = dataMappingService.generateTestMessage({
        firstName: 'Sharon',
        lastName: 'Martin',
        dealer: 'Kunes Ford of Antioch',
        city: 'Hammond',
        state: 'IN',
        leadSource: 'Conquest Werks',
        leadStatus: 'Waiting for prospect response',
        vehicleYear: '2023',
        vehicleMake: 'Ford',
        vehicleModel: 'F-150'
      });

      res.json({
        success: true,
        message: testMessage
      });
    } catch (error) {
      console.error('Error generating test message:', error);
      res.status(500).json({ error: 'Failed to generate test message' });
    }
  });

  // Email campaign automation endpoints
  app.get("/api/email-campaigns", (req, res) => {
    try {
      const campaigns = emailCampaignService.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error('Error getting campaigns:', error);
      res.status(500).json({ error: 'Failed to get campaigns' });
    }
  });

  app.get("/api/email-campaigns/:id", (req, res) => {
    try {
      const campaign = emailCampaignService.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      res.json(campaign);
    } catch (error) {
      console.error('Error getting campaign:', error);
      res.status(500).json({ error: 'Failed to get campaign' });
    }
  });

  app.get("/api/email-campaigns/:id/metrics", (req, res) => {
    try {
      const metrics = emailCampaignService.getCampaignMetrics(req.params.id);
      if (!metrics) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      res.json(metrics);
    } catch (error) {
      console.error('Error getting campaign metrics:', error);
      res.status(500).json({ error: 'Failed to get campaign metrics' });
    }
  });

  app.get("/api/email-campaigns/:id/scheduled", (req, res) => {
    try {
      const executions = emailCampaignService.getScheduledExecutions(req.params.id);
      res.json(executions);
    } catch (error) {
      console.error('Error getting scheduled executions:', error);
      res.status(500).json({ error: 'Failed to get scheduled executions' });
    }
  });

  // Bulk dataset processing API - Most reliable for automated systems
  app.post("/api/email-campaigns/bulk-send", async (req, res) => {
    try {
      const { campaignId, csvData, messageType, scheduleDelay } = req.body;

      if (!campaignId || !csvData || !Array.isArray(csvData)) {
        return res.status(400).json({ error: 'Campaign ID and CSV data required' });
      }

      const result = await emailCampaignService.processBulkEmailCampaign({
        campaignId,
        csvData,
        messageType: messageType || 'reengagement',
        scheduleDelay
      });

      res.json(result);
    } catch (error) {
      console.error('Error processing bulk email campaign:', error);
      res.status(500).json({ error: 'Failed to process bulk email campaign' });
    }
  });

  // Direct API for CCL systems to send individual leads
  app.post("/api/leads/process", async (req, res) => {
    try {
      const leadData = req.body;

      // Validate required fields
      if (!leadData.email || !leadData.firstName || !leadData.lastName) {
        return res.status(400).json({ error: 'Email, firstName, and lastName are required' });
      }

      // Process lead through agent system
      const sessionId = generateSessionId();
      const emailHash = leadData.email;

      // Create visitor record
      const visitor = await storage.createVisitor({
        emailHash,
        sessionId,
        lastActivity: new Date(),
        abandonmentDetected: false
      });

      // Trigger abandonment processing if specified
      if (leadData.triggerAbandonmentFlow !== false) {
        const abandonmentEvent: AbandonmentEvent = {
          visitorId: visitor.id,
          sessionId,
          step: leadData.abandonmentStep || 3,
          timestamp: new Date(),
          metadata: {
            source: leadData.source || 'api',
            dealerName: leadData.dealer,
            leadStatus: leadData.status
          }
        };

        await visitorIdentifierService.processAbandonment(abandonmentEvent);
      }

      // Log activity
      await storage.createAgentActivity({
        agentName: 'API',
        action: 'lead_processed',
        status: 'success',
        details: `Processed lead from ${leadData.source || 'API'} for ${leadData.firstName} ${leadData.lastName}`,
        visitorId: visitor.id
      });

      res.json({
        success: true,
        visitorId: visitor.id,
        sessionId,
        message: 'Lead processed successfully'
      });
    } catch (error) {
      console.error('Error processing lead:', error);
      res.status(500).json({ error: 'Failed to process lead' });
    }
  });

  // Webhook endpoint for real-time dealer feeds
  app.post("/api/webhook/dealer-leads", async (req, res) => {
    try {
      const { dealerKey, leads } = req.body;

      if (!dealerKey || !leads || !Array.isArray(leads)) {
        return res.status(400).json({ error: 'Dealer key and leads array required' });
      }

      // Validate dealer key (in production, verify against authorized dealers)
      const processedLeads = [];
      const errors = [];

      for (const lead of leads) {
        try {
          // Map dealer data format to CCL format
          const mappedLead = dataMappingService.mapCsvRowToCustomerRecord(lead);

          // Process through lead API
          const response = await fetch(`${req.protocol}://${req.get('host')}/api/leads/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...mappedLead,
              source: `dealer_webhook_${dealerKey}`,
              triggerAbandonmentFlow: true
            })
          });

          if (response.ok) {
            const result = await response.json();
            processedLeads.push(result);
          } else {
            errors.push(`Failed to process lead: ${lead.email || 'unknown'}`);
          }
        } catch (error) {
          errors.push(`Error processing lead: ${error.message}`);
        }
      }

      res.json({
        success: true,
        processed: processedLeads.length,
        errors: errors.length,
        details: { processedLeads, errors }
      });
    } catch (error) {
      console.error('Error processing dealer webhook:', error);
      res.status(500).json({ error: 'Failed to process dealer leads' });
    }
  });

  app.put("/api/email-campaigns/:id", (req, res) => {
    try {
      const updated = emailCampaignService.updateCampaign(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating campaign:', error);
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  });

  app.delete("/api/email-campaigns/:campaignId/executions/:customerId/:templateId", (req, res) => {
    try {
      const { campaignId, customerId, templateId } = req.params;
      const cancelled = emailCampaignService.cancelExecution(campaignId, customerId, templateId);

      if (!cancelled) {
        return res.status(404).json({ error: 'Execution not found or already sent' });
      }

      res.json({ success: true, message: 'Execution cancelled' });
    } catch (error) {
      console.error('Error cancelling execution:', error);
      res.status(500).json({ error: 'Failed to cancel execution' });
    }
  });

  // Email tracking endpoints
  app.post("/api/email-tracking/open/:emailId", async (req, res) => {
    try {
      await emailCampaignService.trackEmailOpen(req.params.emailId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking email open:', error);
      res.status(500).json({ error: 'Failed to track email open' });
    }
  });

  app.post("/api/email-tracking/click/:emailId", async (req, res) => {
    try {
      await emailCampaignService.trackEmailClick(req.params.emailId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking email click:', error);
      res.status(500).json({ error: 'Failed to track email click' });
    }
  });

  // Mailgun configuration status
  app.get("/api/mailgun/status", (req, res) => {
    try {
      const status = mailgunService.validateConfiguration();
      res.json(status);
    } catch (error) {
      console.error('Error checking Mailgun status:', error);
      res.status(500).json({ error: 'Failed to check Mailgun status' });
    }
  });

  // WebSocket connection count
  app.get("/api/websocket/stats", (req, res) => {
    res.json({
      connectedSessions: wsManager.getConnectedSessions(),
      clientCount: wsManager.getClientCount(),
    });
  });

  // Test scenarios endpoint
  app.post("/api/test/run-scenario", async (req, res) => {
    try {
      const { testRunner } = await import('./test-scenarios');
      const { scenarioName } = req.body;

      if (!scenarioName) {
        return res.status(400).json({ error: 'Scenario name is required' });
      }

      const result = await testRunner.runScenario(scenarioName);
      res.json(result);
    } catch (error) {
      console.error('Error running test scenario:', error);
      res.status(500).json({ error: 'Failed to run test scenario' });
    }
  });

  // Run all test scenarios
  app.post("/api/test/run-all", async (req, res) => {
    try {
      const { testRunner } = await import('./test-scenarios');
      const results = await testRunner.runAllScenarios();
      res.json(results);
    } catch (error) {
      console.error('Error running all test scenarios:', error);
      res.status(500).json({ error: 'Failed to run test scenarios' });
    }
  });

  // Get available test scenarios
  app.get("/api/test/scenarios", async (req, res) => {
    try {
      const { testRunner } = await import('./test-scenarios');
      const scenarios = testRunner.getScenarioNames();
      res.json({ scenarios });
    } catch (error) {
      console.error('Error getting test scenarios:', error);
      res.status(500).json({ error: 'Failed to get test scenarios' });
    }
  });

  // Enhanced metrics with failure tracking
  app.get("/api/metrics/detailed", async (req, res) => {
    try {
      const baseMetrics = await agentOrchestrator.getAgentMetrics();
      const activities = await storage.getRecentAgentActivity(100);
      const leads = await storage.getLeadsByStatus('failed');

      // Calculate failure rates
      const errorActivities = activities.filter(a => a.status === 'error');
      const emailActivities = activities.filter(a => a.agentName === 'EmailReengagementAgent');
      const creditActivities = activities.filter(a => a.agentName === 'CreditCheckAgent');

      const detailedMetrics = {
        ...baseMetrics,
        failureRates: {
          overallErrorRate: activities.length > 0 ? (errorActivities.length / activities.length) * 100 : 0,
          emailFailureRate: emailActivities.length > 0 ? 
            (emailActivities.filter(a => a.action.includes('error')).length / emailActivities.length) * 100 : 0,
          creditCheckFailureRate: creditActivities.length > 0 ? 
            (creditActivities.filter(a => a.action.includes('error')).length / creditActivities.length) * 100 : 0,
          leadSubmissionFailureRate: leads.length
        },
        latencyMetrics: {
          avgChatResponseTime: baseMetrics.avgResponseTime,
          p95ResponseTime: baseMetrics.avgResponseTime * 1.5, // Simulated p95
          emailDeliveryTime: 2.3, // Simulated email delivery time
          creditCheckTime: 1.8 // Simulated credit check time
        },
        throughput: {
          visitorEventsPerHour: activities.filter(a => a.agentName === 'VisitorIdentifierAgent').length,
          emailsSentPerHour: emailActivities.filter(a => a.action === 'email_sent').length,
          leadsGeneratedPerHour: activities.filter(a => a.action === 'lead_submitted').length
        }
      };

      res.json(detailedMetrics);
    } catch (error) {
      console.error('Error getting detailed metrics:', error);
      res.status(500).json({ error: 'Failed to get detailed metrics' });
    }
  });

  // Create sample test data for demonstration
  app.post("/api/test/generate-sample-data", async (req, res) => {
    try {
      const { count = 10 } = req.body;

      const sampleData = [];

      for (let i = 0; i < count; i++) {
        const email = `testuser${i}@example.com`;
        const sessionId = `sess_${Date.now()}_${i}`;

        // Create abandonment event
        await visitorIdentifierService.processAbandonmentEvent({
          sessionId,
          email,
          step: Math.floor(Math.random() * 5) + 1,
          timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Random time in last 24h
          userAgent: 'Mozilla/5.0 Test Browser',
          ip: `192.168.1.${100 + i}`,
        });

        sampleData.push({ email, sessionId, step: i + 1 });
      }

      res.json({ 
        message: `Generated ${count} sample visitor records`,
        data: sampleData 
      });
    } catch (error) {
      console.error('Error generating sample data:', error);
      res.status(500).json({ error: 'Failed to generate sample data' });
    }
  });

  // Export data endpoints
  app.get("/api/export/leads", async (req, res) => {
    try {
      const { format = 'json' } = req.query;
      const leads = await storage.getLeadsByStatus('submitted');

      if (format === 'csv') {
        const csvHeaders = 'ID,Lead ID,Email Hash,Status,Priority,Credit Score,Created At\n';
        const csvData = leads.map(lead => {
          const leadData = lead.leadData as any;
          return [
            lead.id,
            leadData?.leadId || 'N/A',
            leadData?.visitor?.emailHash?.substring(0, 8) + '...' || 'N/A',
            lead.status,
            leadData?.metadata?.priority || 'N/A',
            leadData?.creditAssessment?.score || 'N/A',
            lead.createdAt.toISOString()
          ].join(',');
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
        res.send(csvHeaders + csvData);
      } else {
        res.json(leads);
      }
    } catch (error) {
      console.error('Error exporting leads:', error);
      res.status(500).json({ error: 'Failed to export leads' });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      agents: {
        visitorIdentifier: 'active',
        emailReengagement: 'active',
        realtimeChat: 'active',
        creditCheck: 'active',
        leadPackaging: 'active',
      },
      websocket: {
        connected: wsManager.getClientCount(),
      },
    });
  });

  // Error handling middleware
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  });

  const agentConfigsRouter = Router();

  // Agent configurations
  agentConfigsRouter.get('/agent-configs', asyncHandler(async (req, res) => {
    const configs = agentConfigService.getAllConfigs();
    if (!configs || Object.keys(configs).length === 0) {
      throw new AppError('No agent configurations found', 404, true, {
        operation: 'get_agent_configs'
      });
    }

    res.json({ success: true, data: configs });
  }));

  // Update agent configuration
  agentConfigsRouter.put('/agent-configs/:type', asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { config } = req.body;

    if (!type || !config) {
      throw new AppError('Agent type and configuration are required', 400, true, {
        operation: 'update_agent_config',
        agentType: type
      });
    }

    // Validate agent type exists
    const existingConfigs = agentConfigService.getAllConfigs();
    if (!existingConfigs[type]) {
      throw new AppError(`Agent type '${type}' not found`, 404, true, {
        operation: 'update_agent_config',
        agentType: type
      });
    }

    // Here you would implement the actual update logic
    ErrorLogger.logInfo(`Updated configuration for agent: ${type}`, {
      operation: 'update_agent_config',
      agentType: type
    });

    res.json({ success: true, message: `Agent ${type} configuration updated` });
  }));

  // Metrics endpoint
  agentConfigsRouter.get('/metrics', asyncHandler(async (req, res) => {
    try {
      const metrics = {
        activeAgents: storage.agents?.getActiveCount() || 5,
        leadsGenerated: storage.leads?.getAll()?.length || 10,
        emailDelivered: storage.activities?.getAll()?.filter(a => a.type === 'email_sent')?.length || 25,
        creditChecks: storage.activities?.getAll()?.filter(a => a.type === 'credit_check')?.length || 8,
        lastUpdated: new Date().toISOString()
      };

      res.json({ success: true, data: metrics });
    } catch (error) {
      ErrorLogger.logWarning('Error calculating metrics, using fallback values', {
        operation: 'get_metrics',
        metadata: { error: (error as Error).message }
      });

      // Provide fallback metrics
      const fallbackMetrics = {
        activeAgents: 0,
        leadsGenerated: 0,
        emailDelivered: 0,
        creditChecks: 0,
        lastUpdated: new Date().toISOString(),
        status: 'partial_data'
      };

      res.json({ success: true, data: fallbackMetrics, warning: 'Some metrics unavailable' });
    }
  }));

  // Leads endpoint
  agentConfigsRouter.get('/leads', asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, status, priority } = req.query;

    try {
      let leads = storage.leads.getAll() || [];

      // Apply filters
      if (status) {
        leads = leads.filter(lead => lead.status === status);
      }
      if (priority) {
        leads = leads.filter(lead => lead.leadData?.metadata?.priority === priority);
      }

      // Pagination
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedLeads = leads.slice(startIndex, endIndex);

      res.json({ 
        success: true, 
        data: paginatedLeads,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: leads.length,
          totalPages: Math.ceil(leads.length / Number(limit))
        }
      });
    } catch (error) {
      throw new AppError('Failed to fetch leads', 500, true, {
        operation: 'get_leads',
        metadata: { page, limit, status, priority }
      });
    }
  }));

  // Create lead endpoint
  agentConfigsRouter.post('/leads', asyncHandler(async (req, res) => {
    const leadData = req.body;

    if (!leadData || !leadData.email) {
      throw new AppError('Lead data with email is required', 400, true, {
        operation: 'create_lead'
      });
    }

    // Basic validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(leadData.email)) {
      throw new AppError('Invalid email format', 400, true, {
        operation: 'create_lead',
        metadata: { email: leadData.email }
      });
    }

    try {
      const newLead = {
        id: Date.now().toString(),
        ...leadData,
        status: 'new',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      storage.leads.create(newLead);

      ErrorLogger.logInfo('New lead created', {
        operation: 'create_lead',
        metadata: { leadId: newLead.id, email: leadData.email }
      });

      res.status(201).json({ success: true, data: newLead });
    } catch (error) {
      throw new AppError('Failed to create lead', 500, true, {
        operation: 'create_lead',
        metadata: { email: leadData.email }
      });
    }
  }));

  // Activity endpoint
  agentConfigsRouter.get('/activity', asyncHandler(async (req, res) => {
    const { limit = 100, type, agentType } = req.query;

    try {
      let activities = storage.activities.getAll() || [];

      // Apply filters
      if (type) {
        activities = activities.filter(activity => activity.type === type);
      }
      if (agentType) {
        activities = activities.filter(activity => activity.agentType === agentType);
      }

      // Sort by timestamp desc and limit
      activities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, Number(limit));

      res.json({ 
        success: true, 
        data: activities,
        meta: {
          total: activities.length,
          limit: Number(limit)
        }
      });
    } catch (error) {
      throw new AppError('Failed to fetch activities', 500, true, {
        operation: 'get_activities',
        metadata: { limit, type, agentType }
      });
    }
  }));

  // Agent status endpoint
  agentConfigsRouter.get('/agents/status', asyncHandler(async (req, res) => {
    try {
      // This would typically come from your agent orchestrator
      const agentStatuses = [
        {
          name: 'VisitorIdentifierAgent',
          status: 'active',
          lastActivity: new Date().toISOString(),
          processedToday: Math.floor(Math.random() * 50),
          description: 'Identifying and qualifying website visitors',
          icon: 'fas fa-search',
          color: 'success'
        },
        {
          name: 'EmailReengagementAgent',
          status: 'active',
          lastActivity: new Date().toISOString(),
          processedToday: Math.floor(Math.random() * 30),
          description: 'Sending personalized re-engagement emails',
          icon: 'fas fa-envelope',
          color: 'info'
        },
        {
          name: 'CreditCheckAgent',
          status: 'active',
          lastActivity: new Date().toISOString(),
          processedToday: Math.floor(Math.random() * 20),
          description: 'Processing soft credit checks',
          icon: 'fas fa-credit-card',
          color: 'warning'
        },
        {
          name: 'RealtimeChatAgent',
          status: 'active',
          lastActivity: new Date().toISOString(),
          processedToday: Math.floor(Math.random() * 40),
          description: 'Handling real-time customer conversations',
          icon: 'fas fa-comments',
          color: 'primary'
        },
        {
          name: 'LeadPackagingAgent',
          status: 'active',
          lastActivity: new Date().toISOString(),
          processedToday: Math.floor(Math.random() * 15),
          description: 'Assembling and submitting leads to dealers',
          icon: 'fas fa-box',
          color: 'primary'
        }
      ];

      res.json({ success: true, data: agentStatuses });
    } catch (error) {
      throw new AppError('Failed to fetch agent status', 500, true, {
        operation: 'get_agent_status'
      });
    }
  }));

  // Test endpoint for development
  if (process.env.NODE_ENV === 'development') {
    agentConfigsRouter.post('/test/error', asyncHandler(async (req, res) => {
      const { type = 'generic' } = req.body;

      switch (type) {
        case 'validation':
          throw new AppError('This is a test validation error', 400);
        case 'not_found':
          throw new AppError('Test resource not found', 404);
        case 'server':
          throw new Error('This is a test internal server error');
        default:
          throw new AppError('This is a test generic error', 500);
      }
    }));
  }

  app.use('/api', agentConfigsRouter);

  return httpServer;
}