import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  sessionId: text("session_id"),
  abandonmentStep: integer("abandonment_step"),
  isAbandoned: boolean("is_abandoned").default(false),
  lastActivity: timestamp("last_activity").defaultNow(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  visitorId: integer("visitor_id").references(() => visitors.id),
  email: text("email").notNull(),
  phone: text("phone"),
  creditStatus: text("credit_status"), // 'approved', 'pending', 'declined'
  source: text("source"), // 'abandonment', 'email_reengagement', 'live_chat'
  status: text("status").default("pending"), // 'pending', 'processing', 'submitted', 'failed'
  dealerCrmSubmitted: boolean("dealer_crm_submitted").default(false),
  leadData: jsonb("lead_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  visitorId: integer("visitor_id").references(() => visitors.id),
  isActive: boolean("is_active").default(true),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => chatSessions.sessionId),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const emailCampaigns = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  visitorId: integer("visitor_id").references(() => visitors.id),
  emailType: text("email_type").notNull(),
  returnToken: text("return_token").notNull().unique(),
  tokenExpiry: timestamp("token_expiry").notNull(),
  sent: boolean("sent").default(false),
  opened: boolean("opened").default(false),
  clicked: boolean("clicked").default(false),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentActivity = pgTable("agent_activity", {
  id: serial("id").primaryKey(),
  agentName: text("agent_name").notNull(),
  action: text("action").notNull(),
  entityId: text("entity_id"),
  entityType: text("entity_type"),
  status: text("status"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertVisitorSchema = createInsertSchema(visitors).omit({
  id: true,
  createdAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({
  id: true,
  createdAt: true,
});

export const insertAgentActivitySchema = createInsertSchema(agentActivity).omit({
  id: true,
  timestamp: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Visitor = typeof visitors.$inferSelect;
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;

export type AgentActivity = typeof agentActivity.$inferSelect;
export type InsertAgentActivity = z.infer<typeof insertAgentActivitySchema>;

// Event types for agent communication
export interface AbandonmentEvent {
  visitorId: number;
  sessionId: string;
  abandonmentStep: number;
  emailHash: string;
  metadata?: any;
}

export interface LeadReadyEvent {
  visitorId: number;
  source: string;
}

export interface EmailSentEvent {
  campaignId: number;
  visitorId: number;
  returnToken: string;
}

export interface CreditApprovedEvent {
  visitorId: number;
  creditStatus: string;
  creditData?: any;
}

export interface LeadSubmittedEvent {
  leadId: number;
  dealerResponse?: any;
}
