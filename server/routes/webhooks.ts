import { Router } from 'express';
import { storageService } from '../services/storage-service';
import multer from 'multer';

const router = Router();
const upload = multer();

// This endpoint is designed to be called by an email service provider (e.g., Mailgun)
// when a lead replies to an email.
// It requires the email provider to be configured to send a POST request with
// the sender's email, the subject, and the body of the email.
router.post('/email-reply', upload.none(), async (req, res) => {
  // The field names 'sender', 'subject', and 'stripped-text' are commonly used by Mailgun.
  // Adjust these if your email provider uses different field names.
  const sender = req.body.sender;
  const subject = req.body.subject;
  const body = req.body['stripped-text']; // 'stripped-text' is the plain-text body from Mailgun

  if (!sender || !subject || !body) {
    return res.status(400).json({ 
      error: "Missing required fields: sender, subject, and stripped-text (email body)." 
    });
  }

  try {
    const result = await storageService.handleEmailReply(sender, subject, body);
    res.status(200).json(result);
  } catch (error) {
    console.error('Failed to handle email reply webhook:', error);
    res.status(500).json({ error: 'Failed to process email reply.' });
  }
});

export default router;
