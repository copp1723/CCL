import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const visitors = pgTable("visitors", {
  id: serial("id").primaryKey(),
  emailHash: text("email_hash").notNull().unique(),
  sessionId: text("session_id").notNull(),
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
  visitorId: integer("visitor_id").references(() => visitors.id).notNull(),
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
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// System leads table
export const systemLeads = pgTable("system_leads", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  status: text("status").notNull().default("new"), // new, contacted, qualified, closed
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
  status: text("status").notNull().default("active"), // active, inactive, error
  processedToday: integer("processed_today").default(0),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  lastActivity: timestamp("last_activity").defaultNow(),
});

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  visitorId: integer("visitor_id").references(() => visitors.id).notNull(),
  leadData: jsonb("lead_data").notNull(),
  status: text("status").notNull().default("pending"), // pending, submitted, failed
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
  status: text("status").notNull(), // success, error, pending
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas for system tables
export const insertSystemLeadSchema = createInsertSchema(systemLeads).omit({
  createdAt: true,
});

export const insertSystemActivitySchema = createInsertSchema(systemActivities).omit({
  timestamp: true,
});

export const insertSystemAgentSchema = createInsertSchema(systemAgents).omit({
  lastActivity: true,
});

// Insert schemas
export const insertVisitorSchema = createInsertSchema(visitors).omit({
  id: true,
  createdAt: true,
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({
  id: true,
  createdAt: true,
});



export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export const insertAgentActivitySchema = createInsertSchema(agentActivity).omit({
  id: true,
  createdAt: true,
});

// Types for system tables
export type InsertSystemLead = z.infer<typeof insertSystemLeadSchema>;
export type SystemLead = typeof systemLeads.$inferSelect;

export type InsertSystemActivity = z.infer<typeof insertSystemActivitySchema>;
export type SystemActivity = typeof systemActivities.$inferSelect;

export type InsertSystemAgent = z.infer<typeof insertSystemAgentSchema>;
export type SystemAgent = typeof systemAgents.$inferSelect;

// Insert schema for users
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type Visitor = typeof visitors.$inferSelect;

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;

export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;



export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type InsertAgentActivity = z.infer<typeof insertAgentActivitySchema>;
export type AgentActivity = typeof agentActivity.$inferSelect;
