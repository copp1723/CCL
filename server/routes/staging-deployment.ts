import { Router } from 'express';
import config from '../config/environment';
import emailService from '../services/email-onerylie';
import { storage } from '../storage';
import { handleApiError } from '../utils/error-handler';

const router = Router();

// Domain verification endpoint for Replit deployment
router.get('/domain-verification', async (req, res) => {
  try {
    const conf = config.get();
    
    res.json({
      success: true,
      data: {
        domain: 'onerylie.com',
        environment: conf.NODE_ENV,
        emailDomain: conf.MAILGUN_DOMAIN,
        fromEmail: conf.MAILGUN_FROM_EMAIL,
        corsOrigin: conf.CORS_ORIGIN,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Email system test for staging
router.post('/test-email-system', async (req, res) => {
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_001',
          message: 'Test email address is required',
          category: 'validation'
        }
      });
    }

    // Test email connection
    const connectionTest = await emailService.testConnection();
    
    if (!connectionTest.success) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'EMAIL_001',
          message: 'Email service connection failed',
          details: connectionTest.error,
          category: 'email'
        }
      });
    }

    // Send test email
    const emailResult = await emailService.sendEmail({
      to: testEmail,
      subject: 'CCL Staging System Test',
      html: `
        <h2>Complete Car Loans - Staging System Test</h2>
        <p>This is a test email from the staging environment.</p>
        <p><strong>Domain:</strong> onerylie.com</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p>If you receive this email, the system is properly configured for staging deployment.</p>
      `,
      text: 'CCL Staging System Test - If you receive this email, the system is properly configured.'
    });

    if (emailResult.success) {
      await storage.createActivity(
        'email_test_success',
        `Staging email test sent successfully to ${testEmail}`,
        'email_agent',
        { testEmail, messageId: emailResult.messageId }
      );
    }

    res.json({
      success: emailResult.success,
      data: {
        connectionTest: connectionTest.success,
        emailSent: emailResult.success,
        messageId: emailResult.messageId,
        domain: connectionTest.domain
      },
      error: emailResult.error ? {
        code: 'EMAIL_002',
        message: emailResult.error,
        category: 'email'
      } : undefined
    });

  } catch (error) {
    handleApiError(res, error);
  }
});

// Staging deployment status
router.get('/deployment-status', async (req, res) => {
  try {
    const conf = config.get();
    const stats = await storage.getStats();
    
    // Check production readiness
    const readiness = config.validateProductionReadiness();
    
    res.json({
      success: true,
      data: {
        environment: conf.NODE_ENV,
        ready: readiness.ready,
        issues: readiness.issues,
        domain: {
          mailgun: conf.MAILGUN_DOMAIN,
          fromEmail: conf.MAILGUN_FROM_EMAIL,
          configured: !!conf.MAILGUN_API_KEY
        },
        system: {
          uptime: Math.round(stats.uptime / 1000),
          leads: stats.leads,
          activities: stats.activities,
          agents: stats.agents
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Lead processing with email integration
router.post('/process-lead-with-email', async (req, res) => {
  try {
    const { email, firstName, lastName, vehicleInterest } = req.body;
    
    if (!email || !firstName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_001',
          message: 'Email and firstName are required',
          category: 'validation'
        }
      });
    }

    // Create lead
    const leadData = {
      email,
      vehicleInterest: vehicleInterest || 'Not specified',
      firstName,
      lastName: lastName || '',
      source: 'staging_api',
      timestamp: new Date().toISOString()
    };

    const newLead = await storage.createLead({
      email,
      status: 'new',
      leadData
    });

    // Send welcome email
    const emailResult = await emailService.sendWelcomeEmail(email, firstName);
    
    await storage.createActivity(
      'lead_created_with_email',
      `New lead created and welcome email sent: ${email}`,
      'system',
      { 
        leadId: newLead.id, 
        emailSent: emailResult.success,
        messageId: emailResult.messageId 
      }
    );

    res.json({
      success: true,
      data: {
        leadId: newLead.id,
        email,
        firstName,
        emailSent: emailResult.success,
        messageId: emailResult.messageId,
        status: 'processed'
      }
    });

  } catch (error) {
    handleApiError(res, error);
  }
});

export default router;