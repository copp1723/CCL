import express, { Request, Response } from "express";
import { mailgunService } from "../services/mailgun-service.js";

// Access the storage layer (either database-backed or fallback)
const storage: any = (global as any).storage || {
  createActivity: async () => {},
};

const router = express.Router();

// GET /settings  – return Mailgun & other email-related config
router.get("/settings", (req: Request, res: Response) => {
  try {
    const mailgunStatus = mailgunService.getStatus();

    const response = {
      mailgun: {
        configured: mailgunStatus.configured,
        domain: mailgunStatus.domain,
        status: mailgunStatus.configured ? "connected" : "not_configured",
      },
      openrouter: {
        configured: !!process.env.OPENROUTER_API_KEY,
        status: process.env.OPENROUTER_API_KEY ? "connected" : "not_configured",
      },
      timing: {
        step1Delay: 24,
        step2Delay: 72,
        step3Delay: 168,
      },
    };

    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch settings" });
  }
});

// POST /send  – trigger a simple bulk send with template & leads array
router.post("/send", async (req: Request, res: Response) => {
  const { leads = [], template } = req.body || {};

  if (!mailgunService.isConfigured()) {
    return res.status(400).json({
      success: false,
      error: "Mailgun is not configured",
    });
  }

  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ success: false, error: "No leads supplied" });
  }

  if (!template || !template.subject || !template.body) {
    return res.status(400).json({ success: false, error: "Invalid template" });
  }

  try {
    const result = await mailgunService.sendCampaignEmails(leads, template);

    // Log activity
    await storage.createActivity(
      "email_campaign",
      `Bulk email campaign sent (${result.sent}/${leads.length})`,
      "EmailReengagementAgent",
      {
        sent: result.sent,
        failed: result.failed,
      }
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Bulk send error:", error);
    res.status(500).json({ success: false, error: error?.message || "Send failed" });
  }
});

export default router;
