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

export const visitors = pgTable("visitors", {
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
});

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
export const systemLeads = pgTable("system_leads", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  status: text("status", { enum: ["new", "contacted", "qualified", "closed"] })
    .notNull()
    .default("new"),
  leadData: jsonb("lead_data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  visitorId: integer("visitor_id")
    .references(() => visitors.id)
    .notNull(),
  leadData: jsonb("lead_data").notNull(),
  status: text("status", { enum: ["pending", "submitted", "failed"] })
    .notNull()
    .default("pending"),
  dealerResponse: jsonb("dealer_response"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
