import { Router } from "express";
import { storageService } from "../services/storage-service";
import { mailgunService } from "../services/mailgun-service";

const router = Router();

// === CAMPAIGN ROUTES ===

// Get all leads (for enrolling)
router.get("/all-leads", async (_req, res) => {
  try {
    const leads = await storageService.getAllLeads();
    res.json(leads);
  } catch (error) {
    console.error("Failed to get leads:", error);
    res.status(500).json({ error: "Failed to fetch leads." });
  }
});

// Get all campaigns
router.get("/", async (_req, res) => {
  try {
    const campaigns = await storageService.getCampaigns();
    res.status(200).json(campaigns);
  } catch (error) {
    console.error("Failed to get campaigns:", error);
    res.status(500).json({ error: "Failed to get campaigns." });
  }
});

// Get a single campaign by ID
router.get("/:campaignId", async (req, res) => {
  const { campaignId } = req.params;
  try {
    const campaign = await storageService.getCampaignById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }
    res.status(200).json(campaign);
  } catch (error) {
    console.error(`Failed to get campaign ${campaignId}:`, error);
    res.status(500).json({ error: "Failed to get campaign." });
  }
});

// Fetch all leads
router.get("/:campaignId/leads/all", async (req, res) => {
  try {
    const leads = await storageService.getAllLeads();
    res.status(200).json(leads);
  } catch (error) {
    console.error("Failed to get all leads:", error);
    res.status(500).json({ error: "Failed to get all leads." });
  }
});

// Fetch enrolled leads for a campaign
router.get("/:campaignId/leads/enrolled", async (req, res) => {
  const { campaignId } = req.params;
  try {
    const leads = await storageService.getEnrolledLeads(campaignId);
    res.status(200).json(leads);
  } catch (error) {
    console.error("Failed to get enrolled leads:", error);
    res.status(500).json({ error: "Failed to get enrolled leads." });
  }
});

// Enroll leads in a campaign
router.post("/:campaignId/enroll-leads", async (req, res) => {
  const { campaignId } = req.params;
  const { leadIds } = req.body;

  try {
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: "Please provide an array of lead IDs to enroll." });
    }

    // Enroll each lead
    const enrolled = [];
    for (const leadId of leadIds) {
      try {
        await storageService.enrollLeadInCampaign(leadId, campaignId);
        enrolled.push(leadId);
      } catch (error) {
        console.error(`Failed to enroll lead ${leadId}:`, error);
      }
    }

    res.status(200).json({
      success: true,
      enrolled: enrolled.length,
      message: `Successfully enrolled ${enrolled.length} leads in campaign`,
    });
  } catch (error) {
    console.error("Failed to enroll leads:", error);
    res.status(500).json({ error: "Failed to enroll leads in campaign." });
  }
});

// Start a campaign with actual email sending
router.put("/:campaignId/start", async (req, res) => {
  const { campaignId } = req.params;
  try {
    // Get the campaign first
    const campaign = await storageService.getCampaignById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    // Check if campaign is already active
    if (campaign.status === "active") {
      return res.status(400).json({ error: "Campaign is already active." });
    }

    // Check if Mailgun is configured
    if (!mailgunService.isConfigured()) {
      return res.status(500).json({
        error: "Email service not configured. Please check Mailgun settings.",
      });
    }

    // Get enrolled leads for this campaign
    const leads = await storageService.getEnrolledLeads(campaignId);

    if (leads.length === 0) {
      return res.status(400).json({
        error: "No leads enrolled in this campaign. Please enroll leads before starting.",
      });
    }

    // Update campaign status to active first
    const updatedCampaign = await storageService.updateCampaign(campaignId, {
      status: "active",
      startedAt: new Date().toISOString(),
    });

    // Prepare email template
    const emailTemplate = {
      subject: campaign.emailSubject || `Welcome to Complete Car Loans - ${campaign.name}`,
      body: campaign.emailTemplate || generateDefaultEmailTemplate(campaign),
    };

    // Send emails to all enrolled leads
    console.log(`Starting email campaign "${campaign.name}" for ${leads.length} leads...`);

    const emailResults = await mailgunService.sendCampaignEmails(leads, emailTemplate);

    // Log the activity with detailed results
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

    // Update campaign with email statistics
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
    console.error(`Failed to start campaign ${campaignId}:`, error);

    // Try to revert campaign status if email sending failed
    try {
      await storageService.updateCampaign(campaignId, { status: "draft" });
    } catch (revertError) {
      console.error("Failed to revert campaign status:", revertError);
    }

    res.status(500).json({
      error: "Failed to start campaign. Please check your email configuration and try again.",
    });
  }
});

// Send test email for campaign
router.post("/:campaignId/test-email", async (req, res) => {
  const { campaignId } = req.params;
  const { testEmail } = req.body;

  if (!testEmail) {
    return res.status(400).json({ error: "Test email address is required." });
  }

  try {
    const campaign = await storageService.getCampaignById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    if (!mailgunService.isConfigured()) {
      return res.status(500).json({
        error: "Email service not configured. Please check Mailgun settings.",
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
  } catch (error) {
    console.error(`Failed to send test email for campaign ${campaignId}:`, error);
    res.status(500).json({ error: "Failed to send test email." });
  }
});

// Update campaign (edit name, goal, status)
router.patch("/:campaignId", async (req, res) => {
  const { campaignId } = req.params;
  try {
    const campaign = await storageService.updateCampaign(campaignId, req.body);
    res.status(200).json(campaign);
  } catch (error) {
    console.error("Failed to update campaign:", error);
    res.status(500).json({ error: "Failed to update campaign." });
  }
});

// Delete campaign
router.delete("/:campaignId", async (req, res) => {
  const { campaignId } = req.params;
  try {
    await storageService.deleteCampaign(campaignId);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete campaign:", error);
    res.status(500).json({ error: "Failed to delete campaign." });
  }
});

// Clone campaign
router.post("/:campaignId/clone", async (req, res) => {
  const { campaignId } = req.params;
  try {
    const newCampaign = await storageService.cloneCampaign(campaignId);
    res.status(201).json(newCampaign);
  } catch (error) {
    console.error("Failed to clone campaign:", error);
    res.status(500).json({ error: "Failed to clone campaign." });
  }
});

// Create a new campaign
router.post("/", async (req, res) => {
  const { name, goal_prompt } = req.body;
  if (!name || !goal_prompt) {
    return res.status(400).json({ error: "Campaign name and goal_prompt are required." });
  }
  try {
    const campaign = await storageService.createCampaign(name, goal_prompt);
    res.status(201).json(campaign);
  } catch (error) {
    console.error("Failed to create campaign:", error);
    res.status(500).json({ error: "Failed to create campaign." });
  }
});

// Add an email template to a campaign
router.post("/:campaignId/templates", async (req, res) => {
  const { campaignId } = req.params;
  const { subject, body, sequence_order, delay_hours } = req.body;

  if (!subject || !body || !sequence_order) {
    return res.status(400).json({ error: "Subject, body, and sequence_order are required." });
  }

  try {
    const template = { subject, body, sequence_order, delay_hours };
    const newTemplate = await storageService.addEmailTemplate(campaignId, template);
    res.status(201).json(newTemplate);
  } catch (error) {
    console.error(`Failed to add template to campaign ${campaignId}:`, error);
    res.status(500).json({ error: "Failed to add email template." });
  }
});

// Enroll leads into a campaign
router.post("/:campaignId/enroll", async (req, res) => {
  const { campaignId } = req.params;
  const { leadIds } = req.body;

  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: "An array of leadIds is required." });
  }

  try {
    const result = await storageService.enrollLeadsInCampaign(campaignId, leadIds);
    res.status(200).json(result);
  } catch (error) {
    console.error(`Failed to enroll leads in campaign ${campaignId}:`, error);
    res.status(500).json({ error: "Failed to enroll leads." });
  }
});

// Get email service status
router.get("/email/status", async (req, res) => {
  try {
    const status = mailgunService.getStatus();
    res.status(200).json(status);
  } catch (error) {
    console.error("Failed to get email service status:", error);
    res.status(500).json({ error: "Failed to get email service status." });
  }
});

// Helper function to generate default email template
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
