import { db } from '../db';
import { campaignSchedules, campaignAttempts, systemLeads } from '@shared/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import emailService from './email-onerylie';
import { emailTemplateManager } from './email-campaign-templates';
import { storage } from '../database-storage';

export interface AttemptConfig {
  attemptNumber: number;
  templateId: string;
  delayHours: number;
  delayDays: number;
  conditions?: {
    skipIfResponded?: boolean;
    skipIfOpened?: boolean;
    maxAttempts?: number;
  };
}

export interface CampaignScheduleConfig {
  name: string;
  description?: string;
  attempts: AttemptConfig[];
  isActive?: boolean;
}

export class MultiAttemptScheduler {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.startScheduler();
  }

  /**
   * Create a new multi-attempt campaign schedule
   */
  async createSchedule(config: CampaignScheduleConfig): Promise<string> {
    const scheduleId = `schedule_${Date.now()}`;
    
    await db.insert(campaignSchedules).values({
      id: scheduleId,
      name: config.name,
      description: config.description || '',
      isActive: config.isActive ?? true,
      attempts: config.attempts,
    });

    await storage.createActivity(
      'schedule_created',
      `Multi-attempt schedule "${config.name}" created with ${config.attempts.length} attempts`,
      'EmailReengagementAgent',
      { 
        scheduleId, 
        attemptCount: config.attempts.length,
        totalDelayDays: Math.max(...config.attempts.map(a => a.delayDays))
      }
    );

    return scheduleId;
  }

  /**
   * Enroll a lead in a multi-attempt campaign
   */
  async enrollLead(scheduleId: string, leadId: string, variables: Record<string, any> = {}): Promise<void> {
    const schedule = await db
      .select()
      .from(campaignSchedules)
      .where(eq(campaignSchedules.id, scheduleId))
      .limit(1);

    if (!schedule[0] || !schedule[0].isActive) {
      throw new Error('Campaign schedule not found or inactive');
    }

    const attempts = schedule[0].attempts as AttemptConfig[];
    const now = new Date();

    // Create scheduled attempts for this lead
    for (const attempt of attempts) {
      const scheduledFor = new Date(now);
      scheduledFor.setHours(scheduledFor.getHours() + attempt.delayHours);
      scheduledFor.setDate(scheduledFor.getDate() + attempt.delayDays);

      const attemptId = `attempt_${scheduleId}_${leadId}_${attempt.attemptNumber}_${Date.now()}`;

      await db.insert(campaignAttempts).values({
        id: attemptId,
        scheduleId,
        leadId,
        attemptNumber: attempt.attemptNumber,
        templateId: attempt.templateId,
        scheduledFor,
        status: 'scheduled',
        variables,
      });
    }

    await storage.createActivity(
      'lead_enrolled',
      `Lead ${leadId} enrolled in multi-attempt schedule "${schedule[0].name}"`,
      'EmailReengagementAgent',
      { 
        scheduleId, 
        leadId, 
        attemptCount: attempts.length,
        firstAttemptTime: attempts[0] ? new Date(now.getTime() + attempts[0].delayHours * 3600000 + attempts[0].delayDays * 86400000).toISOString() : null
      }
    );
  }

  /**
   * Process scheduled email attempts
   */
  async processScheduledAttempts(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();
      
      // Get all scheduled attempts that are due
      const dueAttempts = await db
        .select()
        .from(campaignAttempts)
        .where(
          and(
            eq(campaignAttempts.status, 'scheduled'),
            lte(campaignAttempts.scheduledFor, now)
          )
        )
        .limit(50); // Process in batches

      for (const attempt of dueAttempts) {
        try {
          await this.processAttempt(attempt);
        } catch (error) {
          console.error(`Failed to process attempt ${attempt.id}:`, error);
          
          // Mark attempt as failed
          await db
            .update(campaignAttempts)
            .set({
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            })
            .where(eq(campaignAttempts.id, attempt.id));
        }
      }

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process individual email attempt
   */
  private async processAttempt(attempt: any): Promise<void> {
    // Get lead data
    const lead = await db
      .select()
      .from(systemLeads)
      .where(eq(systemLeads.id, attempt.leadId))
      .limit(1);

    if (!lead[0]) {
      throw new Error(`Lead ${attempt.leadId} not found`);
    }

    const leadData = lead[0].leadData as any;
    const email = leadData.email || lead[0].email;

    if (!email) {
      throw new Error(`No email found for lead ${attempt.leadId}`);
    }

    // Check if we should skip this attempt based on conditions
    const shouldSkip = await this.shouldSkipAttempt(attempt, leadData);
    if (shouldSkip) {
      await db
        .update(campaignAttempts)
        .set({ status: 'skipped' })
        .where(eq(campaignAttempts.id, attempt.id));
      return;
    }

    // Get template and render email
    const variables = {
      ...attempt.variables,
      firstName: leadData.firstName || '',
      lastName: leadData.lastName || '',
      vehicleInterest: leadData.vehicleInterest || 'vehicle',
      ...leadData
    };

    const rendered = emailTemplateManager.renderTemplate(attempt.templateId, variables);
    if (!rendered) {
      throw new Error(`Template ${attempt.templateId} not found`);
    }

    // Send email
    const emailResult = await emailService.sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text
    });

    // Update attempt status
    await db
      .update(campaignAttempts)
      .set({
        status: emailResult.success ? 'sent' : 'failed',
        sentAt: emailResult.success ? new Date() : null,
        messageId: emailResult.messageId || null,
        errorMessage: emailResult.error || null,
      })
      .where(eq(campaignAttempts.id, attempt.id));

    // Log activity
    await storage.createActivity(
      emailResult.success ? 'attempt_sent' : 'attempt_failed',
      `Multi-attempt email ${emailResult.success ? 'sent' : 'failed'} to ${email} (Attempt ${attempt.attemptNumber})`,
      'EmailReengagementAgent',
      {
        attemptId: attempt.id,
        scheduleId: attempt.scheduleId,
        leadId: attempt.leadId,
        attemptNumber: attempt.attemptNumber,
        templateId: attempt.templateId,
        success: emailResult.success,
        messageId: emailResult.messageId,
        error: emailResult.error
      }
    );
  }

  /**
   * Check if attempt should be skipped based on conditions
   */
  private async shouldSkipAttempt(attempt: any, leadData: any): Promise<boolean> {
    // Get schedule to check conditions
    const schedule = await db
      .select()
      .from(campaignSchedules)
      .where(eq(campaignSchedules.id, attempt.scheduleId))
      .limit(1);

    if (!schedule[0]) return true;

    const attempts = schedule[0].attempts as AttemptConfig[];
    const attemptConfig = attempts.find(a => a.attemptNumber === attempt.attemptNumber);

    if (!attemptConfig?.conditions) return false;

    // Check max attempts
    if (attemptConfig.conditions.maxAttempts) {
      const sentCount = await db
        .select()
        .from(campaignAttempts)
        .where(
          and(
            eq(campaignAttempts.leadId, attempt.leadId),
            eq(campaignAttempts.status, 'sent')
          )
        );

      if (sentCount.length >= attemptConfig.conditions.maxAttempts) {
        return true;
      }
    }

    // Additional conditions can be added here
    // skipIfResponded, skipIfOpened would require tracking opens/responses

    return false;
  }

  /**
   * Get campaign schedule status
   */
  async getScheduleStatus(scheduleId: string): Promise<any> {
    const schedule = await db
      .select()
      .from(campaignSchedules)
      .where(eq(campaignSchedules.id, scheduleId))
      .limit(1);

    if (!schedule[0]) {
      throw new Error('Schedule not found');
    }

    // Get attempt statistics
    const attempts = await db
      .select()
      .from(campaignAttempts)
      .where(eq(campaignAttempts.scheduleId, scheduleId));

    const stats = {
      total: attempts.length,
      scheduled: attempts.filter(a => a.status === 'scheduled').length,
      sent: attempts.filter(a => a.status === 'sent').length,
      failed: attempts.filter(a => a.status === 'failed').length,
      skipped: attempts.filter(a => a.status === 'skipped').length,
    };

    return {
      schedule: schedule[0],
      stats,
      enrolledLeads: [...new Set(attempts.map(a => a.leadId))].length,
    };
  }

  /**
   * Get upcoming scheduled attempts
   */
  async getUpcomingAttempts(hours: number = 24): Promise<any[]> {
    const now = new Date();
    const until = new Date(now.getTime() + hours * 60 * 60 * 1000);

    return await db
      .select()
      .from(campaignAttempts)
      .where(
        and(
          eq(campaignAttempts.status, 'scheduled'),
          gte(campaignAttempts.scheduledFor, now),
          lte(campaignAttempts.scheduledFor, until)
        )
      );
  }

  /**
   * Start the scheduler to process attempts automatically
   */
  private startScheduler(): void {
    // Check for due attempts every 5 minutes
    this.intervalId = setInterval(() => {
      this.processScheduledAttempts().catch(console.error);
    }, 5 * 60 * 1000);

    console.log('Multi-attempt scheduler started');
  }

  /**
   * Stop the scheduler
   */
  stopScheduler(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Multi-attempt scheduler stopped');
    }
  }

  /**
   * Get all active schedules
   */
  async getActiveSchedules(): Promise<any[]> {
    return await db
      .select()
      .from(campaignSchedules)
      .where(eq(campaignSchedules.isActive, true));
  }

  /**
   * Pause/resume a schedule
   */
  async toggleSchedule(scheduleId: string, isActive: boolean): Promise<void> {
    await db
      .update(campaignSchedules)
      .set({ 
        isActive,
        updatedAt: new Date()
      })
      .where(eq(campaignSchedules.id, scheduleId));

    await storage.createActivity(
      'schedule_toggled',
      `Multi-attempt schedule ${isActive ? 'activated' : 'paused'}`,
      'EmailReengagementAgent',
      { scheduleId, isActive }
    );
  }
}

export const multiAttemptScheduler = new MultiAttemptScheduler();