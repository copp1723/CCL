import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Outreach attempts tracking table
export const outreachAttempts = pgTable(
  "outreach_attempts",
  {
    id: serial("id").primaryKey(),
    visitorId: integer("visitor_id")
      .references(() => visitors.id)
      .notNull(),
    channel: varchar("channel", { length: 20 }).notNull(), // 'sms', 'email'
    messageContent: text("message_content"),
    externalMessageId: varchar("external_message_id", { length: 255 }), // Twilio SID, SendGrid ID
    status: varchar("status", { length: 20 }).default("sent"), // 'sent', 'delivered', 'failed', 'clicked'
    returnToken: varchar("return_token", { length: 255 }),
    sentAt: timestamp("sent_at").defaultNow(),
    deliveredAt: timestamp("delivered_at"),
    clickedAt: timestamp("clicked_at"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata"), // Store additional data like retry attempts, etc.
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  table => {
    return {
      visitorIdIdx: index("outreach_attempts_visitor_id_idx").on(table.visitorId),
      channelIdx: index("outreach_attempts_channel_idx").on(table.channel),
      statusIdx: index("outreach_attempts_status_idx").on(table.status),
      sentAtIdx: index("outreach_attempts_sent_at_idx").on(table.sentAt),
    };
  }
);

// SFTP file ingestion tracking
export const ingestedFiles = pgTable(
  "ingested_files",
  {
    id: serial("id").primaryKey(),
    fileName: varchar("file_name", { length: 255 }).notNull().unique(),
    filePath: varchar("file_path", { length: 500 }),
    fileSize: integer("file_size"),
    rowCount: integer("row_count").default(0),
    errorCount: integer("error_count").default(0),
    processingTimeMs: integer("processing_time_ms"),
    status: varchar("status", { length: 20 }).default("processed"), // 'processing', 'processed', 'failed'
    errorDetails: jsonb("error_details"),
    processedAt: timestamp("processed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  table => {
    return {
      fileNameIdx: index("ingested_files_file_name_idx").on(table.fileName),
      statusIdx: index("ingested_files_status_idx").on(table.status),
      processedAtIdx: index("ingested_files_processed_at_idx").on(table.processedAt),
    };
  }
);

// Queue jobs tracking (for monitoring BullMQ jobs)
export const queueJobs = pgTable(
  "queue_jobs",
  {
    id: serial("id").primaryKey(),
    jobId: varchar("job_id", { length: 255 }).notNull(),
    queueName: varchar("queue_name", { length: 100 }).notNull(),
    jobType: varchar("job_type", { length: 100 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(), // 'queued', 'processing', 'completed', 'failed'
    priority: integer("priority").default(0),
    attempts: integer("attempts").default(0),
    maxAttempts: integer("max_attempts").default(3),
    data: jsonb("data"),
    result: jsonb("result"),
    error: text("error"),
    processingTime: integer("processing_time"),
    scheduledFor: timestamp("scheduled_for"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  table => {
    return {
      jobIdIdx: index("queue_jobs_job_id_idx").on(table.jobId),
      queueNameIdx: index("queue_jobs_queue_name_idx").on(table.queueName),
      statusIdx: index("queue_jobs_status_idx").on(table.status),
      scheduledForIdx: index("queue_jobs_scheduled_for_idx").on(table.scheduledFor),
    };
  }
);

export const visitors = pgTable(
  "visitors",
  {
    id: serial("id").primaryKey(),
    emailHash: text("email_hash").unique(),
    sessionId: text("session_id").notNull(),
    phoneNumber: text("phone_number"),
    email: text("email"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
    returnToken: text("return_token").unique(),
    returnTokenExpiry: timestamp("return_token_expiry"),
    abandonmentStep: integer("abandonment_step").default(1),
    lastActivity: timestamp("last_activity").notNull().defaultNow(),
    abandonmentDetected: boolean("abandonment_detected").default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),

    // SFTP ingestion tracking
    adClickTs: timestamp("ad_click_ts"),
    formStartTs: timestamp("form_start_ts"),
    formSubmitTs: timestamp("form_submit_ts"),
    ingestSource: varchar("ingest_source", { length: 100 }).default("manual"),

    // Complete PII fields for lead generation
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    street: varchar("street", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 2 }),
    zip: varchar("zip", { length: 10 }),
    employer: varchar("employer", { length: 255 }),
    jobTitle: varchar("job_title", { length: 255 }),
    annualIncome: integer("annual_income"),
    timeOnJobMonths: integer("time_on_job_months"),
    piiComplete: boolean("pii_complete").default(false),

    // Credit check status (if performed)
    creditCheckStatus: varchar("credit_check_status", { length: 20 }), // 'pending', 'approved', 'declined'
    creditScore: integer("credit_score"),
    creditCheckDate: timestamp("credit_check_date"),
  },
  table => {
    return {
      emailHashIdx: index("visitors_email_hash_idx").on(table.emailHash),
      sessionIdIdx: index("visitors_session_id_idx").on(table.sessionId),
      returnTokenIdx: index("visitors_return_token_idx").on(table.returnToken),
      abandonmentIdx: index("visitors_abandonment_idx").on(table.adClickTs, table.formSubmitTs),
      piiCompleteIdx: index("visitors_pii_complete_idx").on(
        table.piiComplete,
        table.abandonmentStep
      ),
    };
  }
);

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  visitorId: integer("visitor_id").references(() => visitors.id),
  isActive: boolean("is_active").default(true),
  messages: jsonb("messages").default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const emailCampaigns = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  visitorId: integer("visitor_id")
    .references(() => visitors.id)
    .notNull(),
  returnToken: text("return_token").notNull().unique(),
  emailSent: boolean("email_sent").default(false),
  emailOpened: boolean("email_opened").default(false),
  clicked: boolean("clicked").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  table => [index("IDX_session_expire").on(table.expire)]
);

// System leads table
export const systemLeads = pgTable(
  "system_leads",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    status: text("status", { enum: ["new", "contacted", "qualified", "closed"] })
      .notNull()
      .default("new"),
    leadData: jsonb("lead_data").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),

    // Enhanced lead tracking for Boberdoo integration
    boberdooStatus: varchar("boberdoo_status", { length: 20 }).default("pending"), // 'pending', 'submitted', 'accepted', 'rejected'
    boberdooResponseJson: jsonb("boberdoo_response_json"),
    boberdooLeadId: varchar("boberdoo_lead_id", { length: 100 }),
    submissionAttempts: integer("submission_attempts").default(0),
    lastSubmissionAttempt: timestamp("last_submission_attempt"),
    creditScore: integer("credit_score"),
    approvedAmount: integer("approved_amount"),
    interestRate: varchar("interest_rate", { length: 10 }), // Store as string to handle percentages
  },
  table => {
    return {
      boberdooStatusIdx: index("system_leads_boberdoo_status_idx").on(table.boberdooStatus),
      submissionAttemptsIdx: index("system_leads_submission_attempts_idx").on(
        table.submissionAttempts
      ),
    };
  }
);

// System activities table
export const systemActivities = pgTable("system_activities", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  agentType: text("agent_type"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// System agents table
export const systemAgents = pgTable("system_agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "inactive", "error"] })
    .notNull()
    .default("active"),
  processedToday: integer("processed_today").default(0),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  lastActivity: timestamp("last_activity").defaultNow(),
});

// Multi-attempt campaign schedules
export const campaignSchedules = pgTable("campaign_schedules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  attempts: jsonb("attempts").notNull(), // Array of attempt configurations
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Campaign attempts tracking
export const campaignAttempts = pgTable("campaign_attempts", {
  id: text("id").primaryKey(),
  scheduleId: text("schedule_id")
    .references(() => campaignSchedules.id)
    .notNull(),
  leadId: text("lead_id")
    .references(() => systemLeads.id)
    .notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  templateId: text("template_id").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  sentAt: timestamp("sent_at"),
  status: text("status", { enum: ["scheduled", "sent", "failed", "skipped"] })
    .notNull()
    .default("scheduled"),
  messageId: text("message_id"),
  errorMessage: text("error_message"),
  variables: jsonb("variables"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    visitorId: integer("visitor_id")
      .references(() => visitors.id)
      .notNull(),
    leadId: varchar("lead_id", { length: 100 }).notNull().unique(), // External lead ID for tracking
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 20 }),
    creditStatus: varchar("credit_status", { length: 20 }), // 'approved', 'declined', 'pending'
    source: varchar("source", { length: 100 }).notNull().default("website"),
    leadData: jsonb("lead_data").notNull(),
    status: text("status", { enum: ["pending", "processing", "submitted", "failed"] })
      .notNull()
      .default("pending"),
    dealerCrmSubmitted: boolean("dealer_crm_submitted").default(false),
    dealerResponse: jsonb("dealer_response"),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  table => {
    return {
      leadIdIdx: index("leads_lead_id_idx").on(table.leadId),
      visitorIdIdx: index("leads_visitor_id_idx").on(table.visitorId),
      statusIdx: index("leads_status_idx").on(table.status),
      sourceIdx: index("leads_source_idx").on(table.source),
    };
  }
);

export const agentActivity = pgTable("agent_activity", {
  id: serial("id").primaryKey(),
  agentName: text("agent_name").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  visitorId: integer("visitor_id").references(() => visitors.id),
  leadId: integer("lead_id").references(() => leads.id),
  status: text("status", { enum: ["success", "error", "pending"] }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas for system tables - using Drizzle types directly
// Note: Zod schemas removed to avoid type inference issues

// Insert schemas - using Drizzle types directly
// Note: Zod schemas removed to avoid type inference issues

// Campaign schedule schemas - using Drizzle types directly
// Note: Zod schemas removed to avoid type inference issues

// Types for system tables - using Drizzle inference directly
export type InsertSystemLead = typeof systemLeads.$inferInsert;
export type SystemLead = typeof systemLeads.$inferSelect;

export type InsertSystemActivity = typeof systemActivities.$inferInsert;
export type SystemActivity = typeof systemActivities.$inferSelect;

export type InsertSystemAgent = typeof systemAgents.$inferInsert;
export type SystemAgent = typeof systemAgents.$inferSelect;

// Campaign types - using Drizzle inference directly
export type InsertCampaignSchedule = typeof campaignSchedules.$inferInsert;
export type CampaignSchedule = typeof campaignSchedules.$inferSelect;

export type InsertCampaignAttempt = typeof campaignAttempts.$inferInsert;
export type CampaignAttempt = typeof campaignAttempts.$inferSelect;

// Insert schema for users - using Drizzle types directly
// Note: Zod schemas removed to avoid type inference issues

// Types - using Drizzle inference directly
export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertVisitor = typeof visitors.$inferInsert;
export type Visitor = typeof visitors.$inferSelect;

export type InsertChatSession = typeof chatSessions.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;

export type InsertEmailCampaign = typeof emailCampaigns.$inferInsert;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;

export type InsertLead = typeof leads.$inferInsert;
export type Lead = typeof leads.$inferSelect;

export type InsertAgentActivity = typeof agentActivity.$inferInsert;
export type AgentActivity = typeof agentActivity.$inferSelect;

// ⬇️───────────────────────────────────────────────────────────────────────────
// 🔧  Missing Type Exports (Fixes TS errors in storage layer)
// ─────────────────────────────────────────────────────────────────────────────

// Ingested files (SFTP / CSV processing)
export type InsertIngestedFile = typeof ingestedFiles.$inferInsert;
export type IngestedFile = typeof ingestedFiles.$inferSelect;

// Outreach attempts (email / sms tracking)
export type InsertOutreachAttempt = typeof outreachAttempts.$inferInsert;
export type OutreachAttempt = typeof outreachAttempts.$inferSelect;
