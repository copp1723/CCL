import express from "express";
import { twilioSms } from "../services/twilio-sms";
import { outreachLogger, logError } from "../logger";
import config from "../config/environment";
import crypto from "crypto";

const router = express.Router();

// Middleware to verify Twilio webhook signature
function verifyTwilioSignature(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const twilioSignature = req.headers["x-twilio-signature"] as string;

  if (!twilioSignature) {
    outreachLogger.warn("Twilio webhook received without signature");
    return res.status(400).json({ error: "Missing Twilio signature" });
  }

  try {
    const messagingConfig = config.getMessagingConfig();
    if (!messagingConfig.twilio.configured) {
      return res.status(400).json({ error: "Twilio not configured" });
    }

    // In production, you'd verify the signature using Twilio's auth token
    // For now, we'll just log that we received it
    outreachLogger.debug(
      { signature: twilioSignature.substring(0, 10) + "***" },
      "Twilio webhook signature received"
    );

    next();
  } catch (error) {
    outreachLogger.error({ error }, "Failed to verify Twilio signature");
    return res.status(400).json({ error: "Invalid signature" });
  }
}

// Twilio SMS status webhook
router.post(
  "/twilio/status",
  express.urlencoded({ extended: true }),
  verifyTwilioSignature,
  async (req, res) => {
    try {
      outreachLogger.info(
        {
          messageId: req.body.MessageSid,
          status: req.body.MessageStatus,
          to: req.body.To?.replace(/\d(?=\d{4})/g, "*"), // Mask phone number
        },
        "Twilio SMS status webhook received"
      );

      // Handle the delivery status update
      await twilioSms.handleDeliveryStatus(req.body);

      // Respond to Twilio quickly
      res.status(200).send("<Response></Response>");
    } catch (error) {
      logError(error as Error, { webhook: req.body }, "Failed to process Twilio status webhook");
      res.status(500).send("<Response></Response>");
    }
  }
);

// Twilio SMS reply webhook (for when users respond to SMS)
router.post(
  "/twilio/reply",
  express.urlencoded({ extended: true }),
  verifyTwilioSignature,
  async (req, res) => {
    try {
      const { From, Body, MessageSid } = req.body;

      outreachLogger.info(
        {
          messageId: MessageSid,
          from: From?.replace(/\d(?=\d{4})/g, "*"), // Mask phone number
          bodyLength: Body?.length || 0,
        },
        "Twilio SMS reply received"
      );

      // TODO: Handle SMS replies - could trigger chat agent or lead qualification
      // For now, we'll just log it and respond with a basic message

      const responseMessage =
        "Thanks for your reply! Please continue your application at the link we sent you, or call us at (555) 123-4567 to speak with Cathy directly.";

      res.status(200).send(`
      <Response>
        <Message>${responseMessage}</Message>
      </Response>
    `);
    } catch (error) {
      logError(error as Error, { webhook: req.body }, "Failed to process Twilio reply webhook");
      res.status(500).send("<Response></Response>");
    }
  }
);

// Health check endpoint for Twilio webhooks
router.get("/twilio/health", (req, res) => {
  const twilioHealth = twilioSms.getServiceInfo();
  res.json({
    status: "healthy",
    service: "twilio-webhooks",
    twilioConfigured: twilioHealth.configured,
    timestamp: new Date().toISOString(),
  });
});

export default router;
