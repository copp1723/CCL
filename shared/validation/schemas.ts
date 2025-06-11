import { z } from "zod";

// Phone number validation schema
export const PhoneSchema = z
  .string()
  .regex(/^\+1\d{10}$/, "Phone must be E.164 format (+1XXXXXXXXXX)")
  .or(
    z.string().regex(/^\(\d{3}\)\s?\d{3}-\d{4}$/, "Phone must be (XXX) XXX-XXXX format")
      .transform(phone => {
        // Convert (XXX) XXX-XXXX to +1XXXXXXXXXX
        const cleaned = phone.replace(/\D/g, '');
        return `+1${cleaned}`;
      })
  )
  .or(
    z.string().regex(/^\d{10}$/, "Phone must be 10 digits")
      .transform(phone => `+1${phone}`)
  );

// Email validation schema
export const EmailSchema = z
  .string()
  .email("Invalid email address")
  .toLowerCase()
  .transform(email => email.trim());

// Address validation schemas
export const StateSchema = z
  .string()
  .length(2, "State must be 2-letter abbreviation")
  .toUpperCase()
  .refine(state => {
    const validStates = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC'
    ];
    return validStates.includes(state);
  }, "Invalid US state abbreviation");

export const ZipCodeSchema = z
  .string()
  .regex(/^\d{5}(-\d{4})?$/, "ZIP code must be XXXXX or XXXXX-XXXX format");

// Name validation schemas
export const NameSchema = z
  .string()
  .min(1, "Name is required")
  .max(50, "Name must be 50 characters or less")
  .regex(/^[a-zA-Z\s\-'\.]+$/, "Name can only contain letters, spaces, hyphens, apostrophes, and periods")
  .transform(name => name.trim());

// Income validation schema
export const IncomeSchema = z
  .number()
  .int("Income must be a whole number")
  .min(0, "Income cannot be negative")
  .max(10000000, "Income seems unreasonably high")
  .or(
    z.string()
      .regex(/^\d+$/, "Income must be numeric")
      .transform(income => parseInt(income))
      .pipe(z.number().int().min(0).max(10000000))
  );

// Employment validation schemas
export const EmployerSchema = z
  .string()
  .min(2, "Employer name must be at least 2 characters")
  .max(100, "Employer name must be 100 characters or less")
  .transform(employer => employer.trim());

export const JobTitleSchema = z
  .string()
  .min(2, "Job title must be at least 2 characters")
  .max(100, "Job title must be 100 characters or less")
  .transform(title => title.trim());

export const TimeOnJobSchema = z
  .number()
  .int("Time on job must be a whole number of months")
  .min(0, "Time on job cannot be negative")
  .max(600, "Time on job seems unreasonably long (50+ years)")
  .or(
    z.string()
      .regex(/^\d+$/, "Time on job must be numeric (months)")
      .transform(months => parseInt(months))
      .pipe(z.number().int().min(0).max(600))
  );

// Complete PII schema for visitor data
export const VisitorPiiSchema = z.object({
  firstName: NameSchema,
  lastName: NameSchema,
  street: z.string()
    .min(5, "Street address must be at least 5 characters")
    .max(255, "Street address must be 255 characters or less")
    .transform(street => street.trim()),
  city: z.string()
    .min(2, "City must be at least 2 characters")
    .max(100, "City must be 100 characters or less")
    .regex(/^[a-zA-Z\s\-'\.]+$/, "City can only contain letters, spaces, hyphens, apostrophes, and periods")
    .transform(city => city.trim()),
  state: StateSchema,
  zip: ZipCodeSchema,
  employer: EmployerSchema,
  jobTitle: JobTitleSchema,
  annualIncome: IncomeSchema,
  timeOnJobMonths: TimeOnJobSchema.optional().default(0),
  phoneNumber: PhoneSchema,
  email: EmailSchema.optional(),
  emailHash: z.string().length(64, "Email hash must be 64 characters").optional(),
});

// Partial PII schema for progressive collection
export const PartialVisitorPiiSchema = VisitorPiiSchema.partial();

// Credit check result schema
export const CreditCheckSchema = z.object({
  approved: z.boolean(),
  creditScore: z.number().int().min(300).max(850).optional(),
  approvedAmount: z.number().int().positive().optional(),
  interestRate: z.number().positive().max(100).optional(), // Percentage
  denialReason: z.string().optional(),
  checkDate: z.date().default(() => new Date()),
});

// Lead package schema for Boberdoo export
export const LeadPackageSchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
  visitor: VisitorPiiSchema,
  engagement: z.object({
    source: z.string().min(1, "Source is required"),
    emailCampaigns: z.number().int().nonnegative().default(0),
    chatSessions: z.number().int().nonnegative().default(0),
    returnTokenUsed: z.boolean().default(false),
    adClickTs: z.date().optional(),
    formStartTs: z.date().optional(),
    abandonmentStep: z.number().int().min(1).max(10).optional(),
  }),
  creditCheck: CreditCheckSchema,
  metadata: z.object({
    createdAt: z.date().default(() => new Date()),
    processedBy: z.string().default("LeadPackagingAgent"),
    version: z.string().default("1.0.0"),
    processingTime: z.number().optional(), // milliseconds
  }),
});

// SFTP ingest row schema (for validating incoming CSV data)
export const SftpIngestRowSchema = z.object({
  click_id: z.string().optional(),
  session_id: z.string().optional(),
  email: z.string().email().optional(),
  email_hash: z.string().optional(),
  phone_number: z.string().optional(),
  click_timestamp: z.string().datetime().or(z.date()).optional(),
  form_start_timestamp: z.string().datetime().or(z.date()).optional(),
  form_submit_timestamp: z.string().datetime().or(z.date()).optional(),
  ip_address: z.string().ip().optional(),
  user_agent: z.string().optional(),
  source: z.string().optional(),
  campaign_id: z.string().optional(),
  ad_group_id: z.string().optional(),
  keyword: z.string().optional(),
});

// Outreach message schema
export const OutreachMessageSchema = z.object({
  visitorId: z.number().int().positive(),
  channel: z.enum(['sms', 'email']),
  messageContent: z.string().min(1, "Message content is required"),
  returnToken: z.string().uuid().optional(),
  scheduledFor: z.date().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

// Boberdoo submission schema
export const BoberdooSubmissionSchema = z.object({
  vendor_id: z.string(),
  vendor_password: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string().length(2),
  zip: z.string(),
  employer: z.string(),
  job_title: z.string(),
  annual_income: z.number().int(),
  time_on_job: z.number().int(),
  credit_score: z.number().int().min(300).max(850).optional(),
  loan_amount: z.number().int().positive().optional(),
  source: z.string(),
  lead_id: z.string(),
});

// Chat message validation
export const ChatMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['user', 'agent']),
  content: z.string().min(1, "Message content is required"),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional(),
});

export const ChatSessionSchema = z.object({
  sessionId: z.string(),
  visitorId: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  messages: z.array(ChatMessageSchema).default([]),
  agentType: z.string().optional(),
  status: z.enum(['active', 'completed', 'abandoned']).default('active'),
  piiCollected: PartialVisitorPiiSchema.optional(),
  piiComplete: z.boolean().default(false),
});

// Utility functions for validation
export function validatePhoneNumber(phone: string): { isValid: boolean; formatted?: string; error?: string } {
  try {
    const formatted = PhoneSchema.parse(phone);
    return { isValid: true, formatted };
  } catch (error) {
    return { isValid: false, error: error instanceof z.ZodError ? error.errors[0].message : 'Invalid phone number' };
  }
}

export function validateEmail(email: string): { isValid: boolean; formatted?: string; error?: string } {
  try {
    const formatted = EmailSchema.parse(email);
    return { isValid: true, formatted };
  } catch (error) {
    return { isValid: false, error: error instanceof z.ZodError ? error.errors[0].message : 'Invalid email' };
  }
}

export function validatePartialPii(data: any): { isValid: boolean; data?: any; errors?: any; missingFields?: string[] } {
  try {
    const validData = PartialVisitorPiiSchema.parse(data);
    
    // Check which required fields are still missing for complete PII
    const requiredFields = ['firstName', 'lastName', 'street', 'city', 'state', 'zip', 'employer', 'jobTitle', 'annualIncome', 'phoneNumber'];
    const missingFields = requiredFields.filter(field => !validData[field as keyof typeof validData]);
    
    return { 
      isValid: true, 
      data: validData, 
      missingFields: missingFields.length > 0 ? missingFields : undefined 
    };
  } catch (error) {
    return { 
      isValid: false, 
      errors: error instanceof z.ZodError ? error.flatten() : error 
    };
  }
}

export function validateCompletePii(data: any): { isValid: boolean; data?: any; errors?: any } {
  try {
    const validData = VisitorPiiSchema.parse(data);
    return { isValid: true, data: validData };
  } catch (error) {
    return { 
      isValid: false, 
      errors: error instanceof z.ZodError ? error.flatten() : error 
    };
  }
}

// Type exports for TypeScript
export type VisitorPii = z.infer<typeof VisitorPiiSchema>;
export type PartialVisitorPii = z.infer<typeof PartialVisitorPiiSchema>;
export type CreditCheck = z.infer<typeof CreditCheckSchema>;
export type LeadPackage = z.infer<typeof LeadPackageSchema>;
export type SftpIngestRow = z.infer<typeof SftpIngestRowSchema>;
export type OutreachMessage = z.infer<typeof OutreachMessageSchema>;
export type BoberdooSubmission = z.infer<typeof BoberdooSubmissionSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatSession = z.infer<typeof ChatSessionSchema>;
