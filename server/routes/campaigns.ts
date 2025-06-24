import { Router } from "express";
import { storageService } from "../services/storage-service";
import { mailgunService } from "../services/mailgun-service";
import { asyncHandler, throwApiError, ApiError } from "../utils/errorHandler";

const router = Router();

// === CAMPAIGN ROUTES ===

// Get all leads (for enrolling)
router.get(
  "/all-leads",
  asyncHandler(async (_req, res) => {
    const leads = await storageService.getAllLeads();
    res.json(leads);
  })
);

// Get all campaigns
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const campaigns = await storageService.getCampaigns();
    res.status(200).json(campaigns);
  })
);

// Get a single campaign by ID
router.get(
  "/:campaignId",
  asyncHandler(async (req, res) => {
    const { campaignId } = req.params;
    const campaign = await storageService.getCampaignById(campaignId);
    if (!campaign) {
      return throwApiError({ statusCode: 404, message: "Campaign not found." });
    }
    res.status(200).json(campaign);
  })
);

// Fetch all leads (Note: This route seems redundant given /all-leads. Consider removing or clarifying purpose)
router.get(
  "/:campaignId/leads/all",
  asyncHandler(async (req, res) => {
    const leads = await storageService.getAllLeads();
    res.status(200).json(leads);
  })
);

// Fetch enrolled leads for a campaign
router.get(
  "/:campaignId/leads/enrolled",
  asyncHandler(async (req, res) => {
    const { campaignId } = req.params;
    const leads = await storageService.getEnrolledLeads(campaignId);
    res.status(200).json(leads);
  })
);

// Enroll leads in a campaign
router.post(
  "/:campaignId/enroll-leads",
  asyncHandler(async (req, res) => {
    const { campaignId } = req.params;
    const { leadIds } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return throwApiError({
        statusCode: 400,
        message: "Please provide an array of lead IDs to enroll.",
      });
    }

    const enrolled = [];
    const errors = [];
    for (const leadId of leadIds) {
      try {
        await storageService.enrollLeadInCampaign(leadId, campaignId);
        enrolled.push(leadId);
      } catch (error) {
        // Log individual enrollment error but continue
        console.error(`Failed to enroll lead ${leadId}:`, error);
        errors.push({ leadId, error: (error as Error).message });
      }
    }

    res.status(200).json({
      success: true,
      enrolled: enrolled.length,
      message: `Successfully enrolled ${enrolled.length} leads in campaign. ${errors.length > 0 ? `${errors.length} failed.` : ""}`,
      errors: errors.length > 0 ? errors : undefined,
    });
  })
);

// Start a campaign with actual email sending
router.put(
  "/:campaignId/start",
  asyncHandler(async (req, res) => {
    const { campaignId } = req.params;
    const campaign = await storageService.getCampaignById(campaignId);
    if (!campaign) {
      return throwApiError({ statusCode: 404, message: "Campaign not found." });
    }
    if (campaign.status === "active") {
      return throwApiError({ statusCode: 400, message: "Campaign is already active." });
    }
    if (!mailgunService.isConfigured()) {
      return throwApiError({
        statusCode: 500,
        message: "Email service not configured. Please check Mailgun settings.",
        errorCode: "EMAIL_SERVICE_UNCONFIGURED",
      });
    }

    const leads = await storageService.getEnrolledLeads(campaignId);
    if (leads.length === 0) {
      return throwApiError({
        statusCode: 400,
        message: "No leads enrolled in this campaign. Please enroll leads before starting.",
      });
    }

    let updatedCampaign;
    try {
      updatedCampaign = await storageService.updateCampaign(campaignId, {
        status: "active",
        startedAt: new Date().toISOString(),
      });

      const emailTemplate = {
        subject: campaign.emailSubject || `Welcome to Complete Car Loans - ${campaign.name}`,
        body: campaign.emailTemplate || generateDefaultEmailTemplate(campaign),
      };

      console.log(`Starting email campaign "${campaign.name}" for ${leads.length} leads...`);
      const emailResults = await mailgunService.sendCampaignEmails(leads, emailTemplate);

      await storageService.createActivity(
        "campaign_started",
        `Campaign "${campaign.name}" started - Sent: ${emailResults.sent}, Failed: ${emailResults.failed}`,
        "campaign-management",
        {
          campaignId,
          campaignName: campaign.name,
          totalLeads: leads.length,
          emailsSent: emailResults.sent,
          emailsFailed: emailResults.failed,
          errors: emailResults.errors,
        }
      );

      await storageService.updateCampaign(campaignId, {
        emailsSent: emailResults.sent,
        emailsFailed: emailResults.failed,
        lastEmailSent: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        campaign: updatedCampaign,
        emailResults,
        message: `Campaign started successfully. Sent ${emailResults.sent} emails to ${leads.length} leads.`,
      });
    } catch (error) {
      // Try to revert campaign status if email sending failed after status update
      if (updatedCampaign && updatedCampaign.status === "active") {
        try {
          await storageService.updateCampaign(campaignId, { status: "draft" });
        } catch (revertError) {
          console.error("Failed to revert campaign status:", revertError);
          // Add to original error or handle as separate issue
          (error as ApiError).details = {
            ...(error as ApiError).details,
            revertError: (revertError as Error).message,
          };
        }
      }
      // Re-throw the original error to be handled by globalErrorHandler
      // It might be better to wrap it in an ApiError if it's not one already
      throwApiError({
        message: "Failed to start campaign. Please check your email configuration and try again.",
        statusCode: 500,
        details: (error as Error).message,
      });
    }
  })
);

// Send test email for campaign
router.post(
  "/:campaignId/test-email",
  asyncHandler(async (req, res) => {
    const { campaignId } = req.params;
    const { testEmail } = req.body;

    if (!testEmail) {
      return throwApiError({ statusCode: 400, message: "Test email address is required." });
    }

    const campaign = await storageService.getCampaignById(campaignId);
    if (!campaign) {
      return throwApiError({ statusCode: 404, message: "Campaign not found." });
    }
    if (!mailgunService.isConfigured()) {
      return throwApiError({
        statusCode: 500,
        message: "Email service not configured. Please check Mailgun settings.",
        errorCode: "EMAIL_SERVICE_UNCONFIGURED",
      });
    }

    const emailTemplate = {
      subject: `[TEST] ${campaign.emailSubject || campaign.name}`,
      body: campaign.emailTemplate || generateDefaultEmailTemplate(campaign),
    };

    await mailgunService.sendEmail({
      to: testEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.body,
    });

    await storageService.createActivity(
      "test_email_sent",
      `Test email sent for campaign "${campaign.name}" to ${testEmail}`,
      "campaign-management",
      { campaignId, testEmail }
    );

    res.status(200).json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
    });
  })
);

// Update campaign (edit name, goal, status)
router.patch(
  "/:campaignId",
  asyncHandler(async (req, res) => {
    const { campaignId } = req.params;
    const campaign = await storageService.updateCampaign(campaignId, req.body);
    res.status(200).json(campaign);
  })
);

// Delete campaign
router.delete(
  "/:campaignId",
  asyncHandler(async (req, res) => {
    const { campaignId } = req.params;
    await storageService.deleteCampaign(campaignId);
    res.status(204).send();
  })
);

// Clone campaign
router.post(
  "/:campaignId/clone",
  asyncHandler(async (req, res) => {
    const { campaignId } = req.params;
    const newCampaign = await storageService.cloneCampaign(campaignId);
    res.status(201).json(newCampaign);
  })
);

// Create a new campaign
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, goal_prompt } = req.body;
    if (!name || !goal_prompt) {
      return throwApiError({
        statusCode: 400,
        message: "Campaign name and goal_prompt are required.",
      });
    }
    const campaign = await storageService.createCampaign(name, goal_prompt);
    res.status(201).json(campaign);
  })
);

// Add an email template to a campaign
router.post(
  "/:campaignId/templates",
  asyncHandler(async (req, res) => {
    const { campaignId } = req.params;
    const { subject, body, sequence_order, delay_hours } = req.body;

    if (!subject || !body || !sequence_order) {
      return throwApiError({
        statusCode: 400,
        message: "Subject, body, and sequence_order are required.",
      });
    }
    const template = { subject, body, sequence_order, delay_hours };
    const newTemplate = await storageService.addEmailTemplate(campaignId, template);
    res.status(201).json(newTemplate);
  })
);

// Enroll leads into a campaign
router.post(
  "/:campaignId/enroll",
  asyncHandler(async (req, res) => {
    const { campaignId } = req.params;
    const { leadIds } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return throwApiError({ statusCode: 400, message: "An array of leadIds is required." });
    }
    const result = await storageService.enrollLeadsInCampaign(campaignId, leadIds);
    res.status(200).json(result);
  })
);

// Get email service status
router.get(
  "/email/status",
  asyncHandler(async (_req, res) => {
    const status = mailgunService.getStatus();
    res.status(200).json(status);
  })
);

// Helper function to generate default email template
// (This function remains as it's specific to campaign email generation)
function generateDefaultEmailTemplate(campaign: any): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c5aa0;">Hi {{firstName}},</h2>
          
          <p>I'm Cathy from Complete Car Loans, and I wanted to personally reach out about your auto financing needs.</p>
          
          <p><strong>Our Goal:</strong> ${campaign.goal_prompt}</p>
          
          <p>We specialize in helping people with all credit situations find the right auto financing solution. Whether you're looking for your first car or upgrading to something newer, we're here to help.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">What makes us different:</h3>
            <ul>
              <li>Soft credit checks (no impact to your score)</li>
              <li>Work with all credit situations</li>
              <li>Quick pre-approval process</li>
              <li>Personalized service from real people</li>
            </ul>
          </div>
          
          <p>Would you like to get started with a quick, no-impact credit check? It only takes a minute and you'll know exactly what you qualify for.</p>
          
          <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>Cathy</strong><br>
            Auto Finance Specialist<br>
            Complete Car Loans<br>
            📞 <a href="tel:+1234567890">Call me directly</a>
          </p>
          
          <p style="font-size: 12px; color: #666; margin-top: 30px;">
            You're receiving this because you expressed interest in auto financing. 
            <a href="#">Unsubscribe</a> if you no longer wish to receive these emails.
          </p>
        </div>
      </body>
    </html>
  `;
}

export default router;
