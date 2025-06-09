import config from "../config/environment";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text: string;
  variables: string[];
  category: "welcome" | "followup" | "reminder" | "approval" | "custom";
}

export interface CampaignConfig {
  id: string;
  name: string;
  description: string;
  templates: EmailTemplate[];
  triggerConditions: {
    leadStatus?: string[];
    daysSinceLastContact?: number;
    vehicleInterest?: string[];
    creditScore?: string;
  };
}

class EmailCampaignTemplateManager {
  private templates: Map<string, EmailTemplate> = new Map();
  private campaigns: Map<string, CampaignConfig> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
    this.initializeDefaultCampaigns();
  }

  private initializeDefaultTemplates() {
    const templates: EmailTemplate[] = [
      {
        id: "welcome_application",
        name: "Welcome - Application Started",
        category: "welcome",
        subject: "{{firstName}}, your auto loan application is being processed",
        variables: ["firstName", "vehicleInterest"],
        html: this.getWelcomeApplicationTemplate(),
        text: this.getWelcomeApplicationTextTemplate(),
      },
      {
        id: "followup_24h",
        name: "Follow-up - 24 Hours",
        category: "followup",
        subject: "{{firstName}}, your auto loan pre-approval is ready",
        variables: ["firstName", "vehicleInterest", "preApprovalAmount"],
        html: this.getFollowup24hTemplate(),
        text: this.getFollowup24hTextTemplate(),
      },
      {
        id: "followup_3day",
        name: "Follow-up - 3 Days",
        category: "followup",
        subject: "{{firstName}}, don't miss out on your auto loan approval",
        variables: ["firstName", "vehicleInterest"],
        html: this.getFollowup3DayTemplate(),
        text: this.getFollowup3DayTextTemplate(),
      },
      {
        id: "followup_7day",
        name: "Follow-up - 7 Days Final",
        category: "followup",
        subject: "{{firstName}}, last chance for your auto loan",
        variables: ["firstName", "vehicleInterest"],
        html: this.getFollowup7DayTemplate(),
        text: this.getFollowup7DayTextTemplate(),
      },
      {
        id: "approval_notification",
        name: "Approval Notification",
        category: "approval",
        subject: "🎉 {{firstName}}, you're approved! Let's get your car",
        variables: ["firstName", "approvalAmount", "monthlyPayment", "vehicleInterest"],
        html: this.getApprovalTemplate(),
        text: this.getApprovalTextTemplate(),
      },
      {
        id: "credit_challenge",
        name: "Credit Challenge Campaign",
        category: "custom",
        subject: "{{firstName}}, bad credit? No problem with Complete Car Loans",
        variables: ["firstName", "vehicleInterest"],
        html: this.getCreditChallengeTemplate(),
        text: this.getCreditChallengeTextTemplate(),
      },
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  private initializeDefaultCampaigns() {
    const campaigns: CampaignConfig[] = [
      {
        id: "new_application_sequence",
        name: "New Application Sequence",
        description: "Automated follow-up sequence for new applications",
        templates: [
          this.templates.get("welcome_application")!,
          this.templates.get("followup_24h")!,
          this.templates.get("followup_3day")!,
          this.templates.get("followup_7day")!,
        ],
        triggerConditions: {
          leadStatus: ["new", "contacted"],
        },
      },
      {
        id: "credit_challenged_campaign",
        name: "Credit Challenged Campaign",
        description: "Specialized campaign for customers with credit challenges",
        templates: [this.templates.get("credit_challenge")!, this.templates.get("followup_3day")!],
        triggerConditions: {
          creditScore: "poor",
        },
      },
      {
        id: "truck_suv_campaign",
        name: "Truck & SUV Campaign",
        description: "Targeted campaign for truck and SUV buyers",
        templates: [
          this.templates.get("welcome_application")!,
          this.templates.get("followup_24h")!,
        ],
        triggerConditions: {
          vehicleInterest: ["truck", "suv", "pickup"],
        },
      },
    ];

    campaigns.forEach(campaign => {
      this.campaigns.set(campaign.id, campaign);
    });
  }

  // Template creation and management methods
  createTemplate(template: Omit<EmailTemplate, "id">): EmailTemplate {
    const id = `custom_${Date.now()}`;
    const newTemplate: EmailTemplate = { ...template, id };
    this.templates.set(id, newTemplate);
    return newTemplate;
  }

  updateTemplate(id: string, updates: Partial<EmailTemplate>): EmailTemplate | null {
    const template = this.templates.get(id);
    if (!template) return null;

    const updatedTemplate = { ...template, ...updates, id };
    this.templates.set(id, updatedTemplate);
    return updatedTemplate;
  }

  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  getTemplate(id: string): EmailTemplate | null {
    return this.templates.get(id) || null;
  }

  getAllTemplates(): EmailTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: EmailTemplate["category"]): EmailTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  // Campaign management methods
  createCampaign(campaign: Omit<CampaignConfig, "id">): CampaignConfig {
    const id = `campaign_${Date.now()}`;
    const newCampaign: CampaignConfig = { ...campaign, id };
    this.campaigns.set(id, newCampaign);
    return newCampaign;
  }

  getCampaign(id: string): CampaignConfig | null {
    return this.campaigns.get(id) || null;
  }

  getAllCampaigns(): CampaignConfig[] {
    return Array.from(this.campaigns.values());
  }

  // Template rendering with variable substitution
  renderTemplate(
    templateId: string,
    variables: Record<string, string>
  ): { subject: string; html: string; text: string } | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    const renderString = (str: string) => {
      return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] || match;
      });
    };

    return {
      subject: renderString(template.subject),
      html: renderString(template.html),
      text: renderString(template.text),
    };
  }

  // Default template content methods
  private getWelcomeApplicationTemplate(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Complete Car Loans</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Your Trusted Auto Finance Partner</p>
        </div>
        
        <div style="padding: 30px; background: white; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Hey {{firstName}}!</h2>
          
          <p style="color: #374151; line-height: 1.6;">Thanks for starting your auto loan application with Complete Car Loans. I'm Cathy, your personal finance specialist, and I'm here to help you get behind the wheel of your {{vehicleInterest}}.</p>
          
          <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #1e40af; font-size: 18px;">Your Application Status</h3>
            <p style="margin: 10px 0; color: #1f2937;"><strong>Status:</strong> In Review</p>
            <p style="margin: 10px 0; color: #1f2937;"><strong>Expected Response:</strong> Within 2-4 hours</p>
            <p style="margin: 10px 0; color: #1f2937;"><strong>Next Step:</strong> Pre-approval decision</p>
          </div>
          
          <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #065f46;">Why Complete Car Loans?</h3>
            <ul style="color: #047857; margin: 0; padding-left: 20px;">
              <li style="margin: 8px 0;">✓ Work with all credit types - even bad credit</li>
              <li style="margin: 8px 0;">✓ Same-day approvals available</li>
              <li style="margin: 8px 0;">✓ Access to 15,000+ dealers nationwide</li>
              <li style="margin: 8px 0;">✓ No hidden fees or surprises</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://completecarloans.com/status" 
               style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Check Application Status
            </a>
          </div>
          
          <p style="color: #374151; line-height: 1.6;">I'll personally review your application and be in touch with your pre-approval details soon. If you have any questions, just reply to this email or call me directly.</p>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #1f2937;"><strong>Cathy Johnson</strong><br>
            <em style="color: #6b7280;">Personal Auto Finance Specialist</em><br>
            Complete Car Loans<br>
            <a href="tel:1-800-CARLOANS" style="color: #2563eb;">1-800-CARLOANS</a></p>
          </div>
        </div>
      </div>
    `;
  }

  private getWelcomeApplicationTextTemplate(): string {
    return `
Hi {{firstName}},

Thanks for starting your auto loan application with Complete Car Loans. I'm Cathy, your personal finance specialist.

Your Application Status:
- Status: In Review  
- Expected Response: Within 2-4 hours
- Next Step: Pre-approval decision

Why Complete Car Loans?
- Work with all credit types - even bad credit
- Same-day approvals available  
- Access to 15,000+ dealers nationwide
- No hidden fees or surprises

I'll personally review your application and be in touch with your pre-approval details soon. If you have any questions, just reply to this email or call me at 1-800-CARLOANS.

Best regards,
Cathy Johnson
Personal Auto Finance Specialist
Complete Car Loans
    `;
  }

  private getFollowup24hTemplate(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Great News, {{firstName}}!</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Your Pre-Approval is Ready</p>
        </div>
        
        <div style="padding: 30px; background: white; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">You're Pre-Approved!</h2>
          
          <p style="color: #374151; line-height: 1.6;">I have exciting news about your {{vehicleInterest}} financing! Your pre-approval came through, and you're qualified for up to <strong style="color: #059669;">{{preApprovalAmount}}</strong>.</p>
          
          <div style="background: #f0fdf4; border: 2px solid #059669; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
            <h3 style="margin-top: 0; color: #065f46;">Your Pre-Approval Details</h3>
            <p style="margin: 0; font-size: 20px; color: #059669; font-weight: bold;">Up to {{preApprovalAmount}}</p>
            <p style="margin: 5px 0 0 0; color: #374151;">Ready to shop with confidence</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://completecarloans.com/find-dealers" 
               style="background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin-right: 10px;">
              Find Dealers Near Me
            </a>
            <a href="https://completecarloans.com/calculate" 
               style="background: #374151; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Calculate Payments
            </a>
          </div>
          
          <p style="color: #374151; line-height: 1.6;">This pre-approval is valid for 30 days and gives you the power to negotiate like a cash buyer. Let's get you into that {{vehicleInterest}} today!</p>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #1f2937;"><strong>Cathy Johnson</strong><br>
            <em style="color: #6b7280;">Personal Auto Finance Specialist</em><br>
            Complete Car Loans<br>
            <a href="tel:1-800-CARLOANS" style="color: #2563eb;">1-800-CARLOANS</a></p>
          </div>
        </div>
      </div>
    `;
  }

  private getFollowup24hTextTemplate(): string {
    return `
Great News, {{firstName}}!

You're Pre-Approved!

I have exciting news about your {{vehicleInterest}} financing! Your pre-approval came through, and you're qualified for up to {{preApprovalAmount}}.

Your Pre-Approval Details:
- Amount: Up to {{preApprovalAmount}}
- Status: Ready to shop with confidence
- Valid: 30 days

This pre-approval gives you the power to negotiate like a cash buyer. Let's get you into that {{vehicleInterest}} today!

Find dealers: https://completecarloans.com/find-dealers
Calculate payments: https://completecarloans.com/calculate

Best regards,
Cathy Johnson
Personal Auto Finance Specialist
Complete Car Loans
1-800-CARLOANS
    `;
  }

  private getFollowup3DayTemplate(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Don't Miss Out, {{firstName}}!</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Your Auto Loan Approval is Waiting</p>
        </div>
        
        <div style="padding: 30px; background: white; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Your {{vehicleInterest}} is Still Available</h2>
          
          <p style="color: #374151; line-height: 1.6;">I noticed you haven't completed your auto loan application yet. No worries - it happens to everyone! The good news is your pre-approval is still active and ready to use.</p>
          
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #991b1b;">Time Sensitive</h3>
            <p style="margin: 0; color: #374151;">Your pre-approval expires in <strong>4 days</strong>. Don't let this opportunity slip away!</p>
          </div>
          
          <div style="background: #f9fafb; border: 1px solid #d1d5db; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #374151;">Quick Reminder - Why Choose Us?</h3>
            <ul style="color: #6b7280; margin: 0; padding-left: 20px;">
              <li style="margin: 8px 0;">✓ Bad credit? No problem - we specialize in all credit types</li>
              <li style="margin: 8px 0;">✓ Get approved in as little as 10 minutes</li>
              <li style="margin: 8px 0;">✓ Shop at 15,000+ dealers with confidence</li>
              <li style="margin: 8px 0;">✓ Lower rates than traditional financing</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://completecarloans.com/continue" 
               style="background: #dc2626; color: white; padding: 16px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
              Complete My Application Now
            </a>
          </div>
          
          <p style="color: #374151; line-height: 1.6;">I'm personally here to help if you have any questions or concerns. Just reply to this email or give me a call directly.</p>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #1f2937;"><strong>Cathy Johnson</strong><br>
            <em style="color: #6b7280;">Personal Auto Finance Specialist</em><br>
            Complete Car Loans<br>
            <a href="tel:1-800-CARLOANS" style="color: #2563eb;">1-800-CARLOANS</a></p>
          </div>
        </div>
      </div>
    `;
  }

  private getFollowup3DayTextTemplate(): string {
    return `
Don't Miss Out, {{firstName}}!

Your {{vehicleInterest}} is Still Available

I noticed you haven't completed your auto loan application yet. No worries - it happens to everyone! The good news is your pre-approval is still active and ready to use.

TIME SENSITIVE: Your pre-approval expires in 4 days. Don't let this opportunity slip away!

Quick Reminder - Why Choose Us?
- Bad credit? No problem - we specialize in all credit types
- Get approved in as little as 10 minutes  
- Shop at 15,000+ dealers with confidence
- Lower rates than traditional financing

Complete your application: https://completecarloans.com/continue

I'm personally here to help if you have any questions or concerns. Just reply to this email or give me a call directly.

Best regards,
Cathy Johnson
Personal Auto Finance Specialist
Complete Car Loans
1-800-CARLOANS
    `;
  }

  private getFollowup7DayTemplate(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #7c2d12; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Last Chance, {{firstName}}</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Your Auto Loan Approval Expires Soon</p>
        </div>
        
        <div style="padding: 30px; background: white; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Final Notice: Your {{vehicleInterest}} Financing</h2>
          
          <p style="color: #374151; line-height: 1.6;">This is my final attempt to reach you about your auto loan pre-approval. I've been holding your spot, but I can only do so for so long.</p>
          
          <div style="background: #451a03; color: white; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
            <h3 style="margin-top: 0; color: white;">⏰ EXPIRES IN 24 HOURS</h3>
            <p style="margin: 0; opacity: 0.9;">After this, you'll need to restart the entire application process</p>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #92400e;">What You're Missing Out On:</h3>
            <ul style="color: #92400e; margin: 0; padding-left: 20px;">
              <li style="margin: 8px 0;">✗ Your reserved pre-approval amount</li>
              <li style="margin: 8px 0;">✗ Locked-in rates (rates are rising)</li>
              <li style="margin: 8px 0;">✗ Priority dealer access</li>
              <li style="margin: 8px 0;">✗ No-hassle financing process</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://completecarloans.com/final-chance" 
               style="background: #7c2d12; color: white; padding: 18px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 18px;">
              SAVE MY PRE-APPROVAL
            </a>
          </div>
          
          <p style="color: #374151; line-height: 1.6;">I really hope to hear from you before your approval expires. If there's anything I can do to help, please don't hesitate to reach out.</p>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #1f2937;"><strong>Cathy Johnson</strong><br>
            <em style="color: #6b7280;">Personal Auto Finance Specialist</em><br>
            Complete Car Loans<br>
            <a href="tel:1-800-CARLOANS" style="color: #2563eb;">1-800-CARLOANS</a></p>
          </div>
        </div>
      </div>
    `;
  }

  private getFollowup7DayTextTemplate(): string {
    return `
Last Chance, {{firstName}}

Your Auto Loan Approval Expires Soon

This is my final attempt to reach you about your auto loan pre-approval. I've been holding your spot, but I can only do so for so long.

⏰ EXPIRES IN 24 HOURS
After this, you'll need to restart the entire application process.

What You're Missing Out On:
- Your reserved pre-approval amount
- Locked-in rates (rates are rising)
- Priority dealer access  
- No-hassle financing process

Save your pre-approval: https://completecarloans.com/final-chance

I really hope to hear from you before your approval expires. If there's anything I can do to help, please don't hesitate to reach out.

Best regards,
Cathy Johnson
Personal Auto Finance Specialist
Complete Car Loans
1-800-CARLOANS
    `;
  }

  private getApprovalTemplate(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🎉 Congratulations {{firstName}}!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">You're APPROVED for {{approvalAmount}}!</p>
        </div>
        
        <div style="padding: 40px; background: white; border-radius: 0 0 8px 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0; text-align: center;">Your {{vehicleInterest}} Awaits!</h2>
          
          <div style="background: linear-gradient(135deg, #ecfdf5, #f0fdf4); border: 2px solid #059669; padding: 30px; border-radius: 12px; margin: 30px 0; text-align: center;">
            <h3 style="margin-top: 0; color: #065f46; font-size: 24px;">Final Approval Details</h3>
            <div style="display: flex; justify-content: space-around; margin: 20px 0;">
              <div>
                <p style="margin: 0; color: #6b7280; font-size: 14px;">APPROVED AMOUNT</p>
                <p style="margin: 5px 0 0 0; font-size: 24px; color: #059669; font-weight: bold;">{{approvalAmount}}</p>
              </div>
              <div>
                <p style="margin: 0; color: #6b7280; font-size: 14px;">MONTHLY PAYMENT</p>
                <p style="margin: 5px 0 0 0; font-size: 24px; color: #059669; font-weight: bold;">{{monthlyPayment}}</p>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="https://completecarloans.com/dealer-network" 
               style="background: #059669; color: white; padding: 18px 36px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 18px; margin-right: 15px;">
              Find My {{vehicleInterest}}
            </a>
            <a href="https://completecarloans.com/documents" 
               style="background: #374151; color: white; padding: 18px 36px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 18px;">
              Get Documents
            </a>
          </div>
          
          <div style="background: #fef9c3; border: 1px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #92400e;">🚗 Ready to Shop Like a Cash Buyer!</h3>
            <p style="margin: 0; color: #92400e;">Your approval gives you the power to negotiate the best price. Dealers know you're serious when you have financing ready!</p>
          </div>
          
          <p style="color: #374151; line-height: 1.6;">I'm so excited for you! You're all set to drive off the lot today. I'll be here to support you through the final steps.</p>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #1f2937;"><strong>Cathy Johnson</strong><br>
            <em style="color: #6b7280;">Personal Auto Finance Specialist</em><br>
            Complete Car Loans<br>
            <a href="tel:1-800-CARLOANS" style="color: #2563eb;">1-800-CARLOANS</a></p>
          </div>
        </div>
      </div>
    `;
  }

  private getApprovalTextTemplate(): string {
    return `
🎉 Congratulations {{firstName}}!

You're APPROVED for {{approvalAmount}}!

Your {{vehicleInterest}} Awaits!

Final Approval Details:
- Approved Amount: {{approvalAmount}}
- Monthly Payment: {{monthlyPayment}}

🚗 Ready to Shop Like a Cash Buyer!
Your approval gives you the power to negotiate the best price. Dealers know you're serious when you have financing ready!

Find your {{vehicleInterest}}: https://completecarloans.com/dealer-network
Get documents: https://completecarloans.com/documents

I'm so excited for you! You're all set to drive off the lot today. I'll be here to support you through the final steps.

Best regards,
Cathy Johnson
Personal Auto Finance Specialist
Complete Car Loans
1-800-CARLOANS
    `;
  }

  private getCreditChallengeTemplate(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">{{firstName}}, Bad Credit? No Problem!</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">We Specialize in Credit Challenges</p>
        </div>
        
        <div style="padding: 30px; background: white; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Your Credit Score Doesn't Define You</h2>
          
          <p style="color: #374151; line-height: 1.6;">At Complete Car Loans, we believe everyone deserves a second chance. Whether you've had bankruptcy, repossession, or just need to rebuild your credit, we're here to help you get that {{vehicleInterest}}.</p>
          
          <div style="background: #dbeafe; border-left: 4px solid #1e40af; padding: 20px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #1e40af;">We Work With All Credit Situations:</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li style="margin: 8px 0;">✓ Bankruptcy (Chapter 7 & 13)</li>
              <li style="margin: 8px 0;">✓ Repossession</li>
              <li style="margin: 8px 0;">✓ Foreclosure</li>
              <li style="margin: 8px 0;">✓ No Credit History</li>
              <li style="margin: 8px 0;">✓ Credit Scores as low as 400</li>
            </ul>
          </div>
          
          <div style="background: #f0fdf4; border: 1px solid #059669; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #065f46;">How We Help Rebuild Your Credit:</h3>
            <ul style="color: #047857; margin: 0; padding-left: 20px;">
              <li style="margin: 8px 0;">✓ Report to all 3 credit bureaus</li>
              <li style="margin: 8px 0;">✓ On-time payments improve your score</li>
              <li style="margin: 8px 0;">✓ Refinancing options after 12 months</li>
              <li style="margin: 8px 0;">✓ Credit education and support</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://completecarloans.com/credit-challenge" 
               style="background: #1e40af; color: white; padding: 16px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
              Get My Credit Challenge Approval
            </a>
          </div>
          
          <p style="color: #374151; line-height: 1.6;">Your past doesn't have to determine your future. Let's get you approved and on the road to better credit today.</p>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #1f2937;"><strong>Cathy Johnson</strong><br>
            <em style="color: #6b7280;">Credit Challenge Specialist</em><br>
            Complete Car Loans<br>
            <a href="tel:1-800-CARLOANS" style="color: #2563eb;">1-800-CARLOANS</a></p>
          </div>
        </div>
      </div>
    `;
  }

  private getCreditChallengeTextTemplate(): string {
    return `
{{firstName}}, Bad Credit? No Problem!

We Specialize in Credit Challenges

Your Credit Score Doesn't Define You

At Complete Car Loans, we believe everyone deserves a second chance. Whether you've had bankruptcy, repossession, or just need to rebuild your credit, we're here to help you get that {{vehicleInterest}}.

We Work With All Credit Situations:
- Bankruptcy (Chapter 7 & 13)
- Repossession
- Foreclosure  
- No Credit History
- Credit Scores as low as 400

How We Help Rebuild Your Credit:
- Report to all 3 credit bureaus
- On-time payments improve your score
- Refinancing options after 12 months
- Credit education and support

Get approved: https://completecarloans.com/credit-challenge

Your past doesn't have to determine your future. Let's get you approved and on the road to better credit today.

Best regards,
Cathy Johnson
Credit Challenge Specialist
Complete Car Loans
1-800-CARLOANS
    `;
  }
}

export const emailTemplateManager = new EmailCampaignTemplateManager();
export default emailTemplateManager;
