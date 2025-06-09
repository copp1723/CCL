import { Router } from "express";
import { emailTemplateManager } from "../services/email-campaign-templates";
import emailService from "../services/email-onerylie";
import { storage } from "../storage";
import { handleApiError } from "../utils/error-handler";
import { sanitizeEmail, sanitizeJsonData } from "../utils/input-sanitizer";
import { multiAttemptScheduler } from "../services/multi-attempt-scheduler";

const router = Router();

// Get all email templates
router.get("/templates", async (req, res) => {
  try {
    const templates = emailTemplateManager.getAllTemplates();
    res.json({
      success: true,
      data: templates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Get templates by category
router.get("/templates/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const templates = emailTemplateManager.getTemplatesByCategory(category as any);
    res.json({
      success: true,
      data: templates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Get specific template
router.get("/templates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const template = emailTemplateManager.getTemplate(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: "TEMPLATE_NOT_FOUND",
          message: "Email template not found",
          category: "validation",
        },
      });
    }

    res.json({
      success: true,
      data: template,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Create new email template
router.post("/templates", async (req, res) => {
  try {
    const { name, subject, html, text, variables, category } = req.body;

    if (!name || !subject || !html) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_001",
          message: "Name, subject, and html content are required",
          category: "validation",
        },
      });
    }

    const template = emailTemplateManager.createTemplate({
      name: name.trim(),
      subject: subject.trim(),
      html: html.trim(),
      text: text?.trim() || "",
      variables: variables || [],
      category: category || "custom",
    });

    await storage.createActivity(
      "template_created",
      `Email template "${template.name}" created`,
      "system",
      { templateId: template.id, category: template.category }
    );

    res.json({
      success: true,
      data: template,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Update email template
router.put("/templates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = sanitizeJsonData(req.body);

    const updatedTemplate = emailTemplateManager.updateTemplate(id, updates);

    if (!updatedTemplate) {
      return res.status(404).json({
        success: false,
        error: {
          code: "TEMPLATE_NOT_FOUND",
          message: "Email template not found",
          category: "validation",
        },
      });
    }

    await storage.createActivity(
      "template_updated",
      `Email template "${updatedTemplate.name}" updated`,
      "system",
      { templateId: id, updates: Object.keys(updates) }
    );

    res.json({
      success: true,
      data: updatedTemplate,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Delete email template
router.delete("/templates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const template = emailTemplateManager.getTemplate(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: "TEMPLATE_NOT_FOUND",
          message: "Email template not found",
          category: "validation",
        },
      });
    }

    const deleted = emailTemplateManager.deleteTemplate(id);

    if (deleted) {
      await storage.createActivity(
        "template_deleted",
        `Email template "${template.name}" deleted`,
        "system",
        { templateId: id }
      );
    }

    res.json({
      success: true,
      data: { deleted },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Preview template with variables
router.post("/templates/:id/preview", async (req, res) => {
  try {
    const { id } = req.params;
    const { variables } = req.body;

    const rendered = emailTemplateManager.renderTemplate(id, variables || {});

    if (!rendered) {
      return res.status(404).json({
        success: false,
        error: {
          code: "TEMPLATE_NOT_FOUND",
          message: "Email template not found",
          category: "validation",
        },
      });
    }

    res.json({
      success: true,
      data: rendered,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Send test email using template
router.post("/templates/:id/test-send", async (req, res) => {
  try {
    const { id } = req.params;
    const { testEmail, variables } = req.body;

    if (!testEmail) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_001",
          message: "Test email address is required",
          category: "validation",
        },
      });
    }

    const sanitizedEmail = sanitizeEmail(testEmail);
    if (!sanitizedEmail) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_002",
          message: "Invalid email format",
          category: "validation",
        },
      });
    }

    const rendered = emailTemplateManager.renderTemplate(id, variables || {});

    if (!rendered) {
      return res.status(404).json({
        success: false,
        error: {
          code: "TEMPLATE_NOT_FOUND",
          message: "Email template not found",
          category: "validation",
        },
      });
    }

    const emailResult = await emailService.sendEmail({
      to: sanitizedEmail,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
    });

    await storage.createActivity(
      "template_test_sent",
      `Test email sent using template ${id} to ${sanitizedEmail}`,
      "email_agent",
      {
        templateId: id,
        testEmail: sanitizedEmail,
        success: emailResult.success,
        messageId: emailResult.messageId,
      }
    );

    res.json({
      success: emailResult.success,
      data: {
        templateId: id,
        testEmail: sanitizedEmail,
        messageId: emailResult.messageId,
        emailSent: emailResult.success,
      },
      error: emailResult.error
        ? {
            code: "EMAIL_SEND_FAILED",
            message: emailResult.error,
            category: "email",
          }
        : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Get all campaigns
router.get("/campaigns", async (req, res) => {
  try {
    const campaigns = emailTemplateManager.getAllCampaigns();
    res.json({
      success: true,
      data: campaigns,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Get specific campaign
router.get("/campaigns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = emailTemplateManager.getCampaign(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CAMPAIGN_NOT_FOUND",
          message: "Email campaign not found",
          category: "validation",
        },
      });
    }

    res.json({
      success: true,
      data: campaign,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Create new campaign
router.post("/campaigns", async (req, res) => {
  try {
    const { name, description, templates, triggerConditions } = req.body;

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_001",
          message: "Campaign name and description are required",
          category: "validation",
        },
      });
    }

    const campaign = emailTemplateManager.createCampaign({
      name: name.trim(),
      description: description.trim(),
      templates: templates || [],
      triggerConditions: triggerConditions || {},
    });

    await storage.createActivity(
      "campaign_created",
      `Email campaign "${campaign.name}" created`,
      "system",
      { campaignId: campaign.id, templateCount: campaign.templates.length }
    );

    res.json({
      success: true,
      data: campaign,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Send campaign email to specific lead
router.post("/campaigns/:campaignId/send/:templateId", async (req, res) => {
  try {
    const { campaignId, templateId } = req.params;
    const { leadId, email, variables } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_001",
          message: "Email address is required",
          category: "validation",
        },
      });
    }

    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_002",
          message: "Invalid email format",
          category: "validation",
        },
      });
    }

    const campaign = emailTemplateManager.getCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CAMPAIGN_NOT_FOUND",
          message: "Email campaign not found",
          category: "validation",
        },
      });
    }

    const rendered = emailTemplateManager.renderTemplate(templateId, variables || {});
    if (!rendered) {
      return res.status(404).json({
        success: false,
        error: {
          code: "TEMPLATE_NOT_FOUND",
          message: "Email template not found",
          category: "validation",
        },
      });
    }

    const emailResult = await emailService.sendEmail({
      to: sanitizedEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    await storage.createActivity(
      "campaign_email_sent",
      `Campaign "${campaign.name}" email sent to ${sanitizedEmail}`,
      "email_agent",
      {
        campaignId,
        templateId,
        leadId,
        email: sanitizedEmail,
        success: emailResult.success,
        messageId: emailResult.messageId,
      }
    );

    res.json({
      success: emailResult.success,
      data: {
        campaignId,
        templateId,
        leadId,
        email: sanitizedEmail,
        messageId: emailResult.messageId,
        emailSent: emailResult.success,
      },
      error: emailResult.error
        ? {
            code: "EMAIL_SEND_FAILED",
            message: emailResult.error,
            category: "email",
          }
        : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Bulk send campaign to multiple leads
router.post("/campaigns/:campaignId/bulk-send", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { templateId, leads, variables } = req.body;

    if (!templateId || !leads || !Array.isArray(leads)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_001",
          message: "Template ID and leads array are required",
          category: "validation",
        },
      });
    }

    const campaign = emailTemplateManager.getCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CAMPAIGN_NOT_FOUND",
          message: "Email campaign not found",
          category: "validation",
        },
      });
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const lead of leads) {
      try {
        const sanitizedEmail = sanitizeEmail(lead.email);
        if (!sanitizedEmail) {
          results.push({
            leadId: lead.id,
            email: lead.email,
            success: false,
            error: "Invalid email format",
          });
          failureCount++;
          continue;
        }

        const leadVariables = { ...variables, ...lead.variables };
        const rendered = emailTemplateManager.renderTemplate(templateId, leadVariables);

        if (!rendered) {
          results.push({
            leadId: lead.id,
            email: sanitizedEmail,
            success: false,
            error: "Template not found",
          });
          failureCount++;
          continue;
        }

        const emailResult = await emailService.sendEmail({
          to: sanitizedEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });

        results.push({
          leadId: lead.id,
          email: sanitizedEmail,
          success: emailResult.success,
          messageId: emailResult.messageId,
          error: emailResult.error,
        });

        if (emailResult.success) {
          successCount++;
        } else {
          failureCount++;
        }

        // Small delay to avoid overwhelming email service
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        results.push({
          leadId: lead.id,
          email: lead.email,
          success: false,
          error: error.message,
        });
        failureCount++;
      }
    }

    await storage.createActivity(
      "campaign_bulk_sent",
      `Bulk campaign "${campaign.name}" sent: ${successCount} success, ${failureCount} failed`,
      "email_agent",
      {
        campaignId,
        templateId,
        totalLeads: leads.length,
        successCount,
        failureCount,
      }
    );

    res.json({
      success: true,
      data: {
        campaignId,
        templateId,
        totalLeads: leads.length,
        successCount,
        failureCount,
        results,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Multi-attempt campaign schedules
router.get("/schedules", async (req, res) => {
  try {
    const schedules = await multiAttemptScheduler.getActiveSchedules();
    res.json({
      success: true,
      data: schedules,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Create multi-attempt schedule
router.post("/schedules", async (req, res) => {
  try {
    const { name, description, attempts } = req.body;

    if (!name || !attempts || !Array.isArray(attempts)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_001",
          message: "Schedule name and attempts array are required",
          category: "validation",
        },
      });
    }

    // Validate attempts configuration
    for (const attempt of attempts) {
      if (
        !attempt.templateId ||
        typeof attempt.delayHours !== "number" ||
        typeof attempt.delayDays !== "number"
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_002",
            message: "Each attempt must have templateId, delayHours, and delayDays",
            category: "validation",
          },
        });
      }
    }

    const scheduleId = await multiAttemptScheduler.createSchedule({
      name: name.trim(),
      description: description?.trim() || "",
      attempts,
      isActive: true,
    });

    res.json({
      success: true,
      data: {
        scheduleId,
        name,
        attemptCount: attempts.length,
        message: `Multi-attempt schedule "${name}" created with ${attempts.length} scheduled attempts`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Get schedule status and statistics
router.get("/schedules/:scheduleId/status", async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const status = await multiAttemptScheduler.getScheduleStatus(scheduleId);

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Enroll lead in multi-attempt schedule
router.post("/schedules/:scheduleId/enroll", async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { leadId, variables } = req.body;

    if (!leadId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_001",
          message: "Lead ID is required",
          category: "validation",
        },
      });
    }

    await multiAttemptScheduler.enrollLead(scheduleId, leadId, variables || {});

    res.json({
      success: true,
      data: {
        scheduleId,
        leadId,
        message: `Lead ${leadId} enrolled in multi-attempt schedule`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Bulk enroll multiple leads
router.post("/schedules/:scheduleId/bulk-enroll", async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { leadIds, variables } = req.body;

    if (!leadIds || !Array.isArray(leadIds)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_001",
          message: "Lead IDs array is required",
          category: "validation",
        },
      });
    }

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    for (const leadId of leadIds) {
      try {
        await multiAttemptScheduler.enrollLead(scheduleId, leadId, variables || {});
        results.push({ leadId, success: true });
        successCount++;
      } catch (error: any) {
        results.push({ leadId, success: false, error: error.message });
        failureCount++;
      }
    }

    res.json({
      success: true,
      data: {
        scheduleId,
        totalLeads: leadIds.length,
        successCount,
        failureCount,
        results,
        message: `Bulk enrollment completed: ${successCount} success, ${failureCount} failed`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Get upcoming scheduled attempts
router.get("/schedules/upcoming", async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const attempts = await multiAttemptScheduler.getUpcomingAttempts(hours);

    res.json({
      success: true,
      data: {
        timeframe: `${hours} hours`,
        attempts,
        count: attempts.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Pause/resume schedule
router.post("/schedules/:scheduleId/toggle", async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_001",
          message: "isActive boolean value is required",
          category: "validation",
        },
      });
    }

    await multiAttemptScheduler.toggleSchedule(scheduleId, isActive);

    res.json({
      success: true,
      data: {
        scheduleId,
        isActive,
        message: `Schedule ${isActive ? "activated" : "paused"}`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Process scheduled attempts manually (for testing)
router.post("/schedules/process-now", async (req, res) => {
  try {
    await multiAttemptScheduler.processScheduledAttempts();

    res.json({
      success: true,
      data: {
        message: "Scheduled attempts processed successfully",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

export default router;
