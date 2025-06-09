import { storageService } from "../services/storage-service";
import { Pool } from "pg";

// This worker runs periodically to send scheduled campaign emails.
class CampaignSender {
  private interval: NodeJS.Timeout | null = null;
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }

  start() {
    console.log("🚀 Starting Campaign Sender Worker...");
    // Run every minute to check for emails to send.
    // In a high-volume production environment, you might use a more robust
    // job queue system like BullMQ or a dedicated cron job service.
    this.interval = setInterval(() => this.processScheduledEmails(), 60 * 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log("🛑 Stopping Campaign Sender Worker...");
    }
  }

  async processScheduledEmails() {
    console.log("⚙️ Checking for scheduled emails...");
    const client = await this.pool.connect();
    try {
      // Find all leads with a next_touch_at in the past and status 'in_progress'
      const scheduledQuery = `
        SELECT * FROM lead_campaign_status
        WHERE next_touch_at <= NOW() AND status = 'in_progress';
      `;
      const { rows } = await client.query(scheduledQuery);

      if (rows.length === 0) {
        console.log("✅ No scheduled emails to send at this time.");
        return;
      }

      console.log(`📩 Found ${rows.length} emails to send.`);

      for (const enrollment of rows) {
        const { lead_id, campaign_id, current_step } = enrollment;

        // Get the next email template in the sequence
        const nextStep = current_step + 1;
        const templateQuery = `
          SELECT * FROM email_templates
          WHERE campaign_id = $1 AND sequence_order = $2;
        `;
        const templateResult = await client.query(templateQuery, [campaign_id, nextStep]);
        const template = templateResult.rows[0];

        if (template) {
          // In a real implementation, you would use an email service here.
          // e.g., await emailService.send(lead.email, template.subject, template.body);
          console.log(
            `📬 SENDING EMAIL: To Lead ${lead_id}, Campaign ${campaign_id}, Step ${nextStep}`
          );
          console.log(`   Subject: ${template.subject}`);

          // Get the next template in the sequence to schedule the next touch
          const nextTemplateQuery = `
            SELECT delay_hours FROM email_templates
            WHERE campaign_id = $1 AND sequence_order = $2;
          `;
          const nextTemplateResult = await client.query(nextTemplateQuery, [
            campaign_id,
            nextStep + 1,
          ]);
          const nextTemplate = nextTemplateResult.rows[0];

          let newStatus = "in_progress";
          let nextTouchAt: Date | null = new Date();

          if (nextTemplate) {
            nextTouchAt.setHours(nextTouchAt.getHours() + nextTemplate.delay_hours);
          } else {
            // This was the last email in the sequence
            newStatus = "completed";
            nextTouchAt = null;
          }

          // Update the lead's campaign status
          const updateQuery = `
            UPDATE lead_campaign_status
            SET current_step = $1, status = $2, next_touch_at = $3, updated_at = NOW()
            WHERE lead_id = $4 AND campaign_id = $5;
          `;
          await client.query(updateQuery, [nextStep, newStatus, nextTouchAt, lead_id, campaign_id]);
          console.log(`   Lead ${lead_id} updated to step ${nextStep}, status '${newStatus}'.`);
        } else {
          // No more templates in the sequence, mark as completed
          const updateQuery = `
            UPDATE lead_campaign_status
            SET status = 'completed', updated_at = NOW()
            WHERE lead_id = $1 AND campaign_id = $2;
          `;
          await client.query(updateQuery, [lead_id, campaign_id]);
          console.log(
            `   No more templates for Lead ${lead_id} in Campaign ${campaign_id}. Marking as completed.`
          );
        }
      }
    } catch (error) {
      console.error("❌ Error processing scheduled emails:", error);
    } finally {
      client.release();
    }
  }
}

export const campaignSender = new CampaignSender();
