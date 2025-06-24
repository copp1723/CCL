/**
 * Standardized error codes for Complete Car Loans API
 * Each error type has consistent naming, HTTP status, and categorization
 */

export enum ErrorCode {
  // Authentication Errors
  AUTHENTICATION_REQUIRED = "AUTH_001",
  SESSION_EXPIRED = "AUTH_002",

  // System Errors (5000-5099)
  SYSTEM_HEALTH_CHECK_FAILED = "SYSTEM_001",
  SYSTEM_STATS_UNAVAILABLE = "SYSTEM_002",
  MEMORY_USAGE_HIGH = "SYSTEM_003",
  SERVICE_UNAVAILABLE = "SYSTEM_004",

  // Agent Errors (5100-5199)
  AGENT_STATUS_FETCH_FAILED = "AGENT_001",
  AGENT_INITIALIZATION_FAILED = "AGENT_002",
  AGENT_COMMUNICATION_ERROR = "AGENT_003",
  AGENT_CONFIGURATION_INVALID = "AGENT_004",

  // Data Processing Errors (5200-5299)
  LEAD_PROCESSING_FAILED = "DATA_001",
  BULK_CAMPAIGN_FAILED = "DATA_002",
  WEBHOOK_PROCESSING_FAILED = "DATA_003",
  INVALID_DATA_FORMAT = "DATA_004",
  DATA_VALIDATION_FAILED = "DATA_005",

  // Email Campaign Errors (5300-5399)
  EMAIL_DELIVERY_FAILED = "EMAIL_001",
  EMAIL_TEMPLATE_INVALID = "EMAIL_002",
  EMAIL_RECIPIENT_INVALID = "EMAIL_003",
  EMAIL_CAMPAIGN_CREATION_FAILED = "EMAIL_004",
  EMAIL_SETTINGS_INVALID = "EMAIL_005",

  // Activity & Logging Errors (5400-5499)
  ACTIVITY_FETCH_FAILED = "ACTIVITY_001",
  ACTIVITY_CREATION_FAILED = "ACTIVITY_002",
  LOG_WRITE_FAILED = "ACTIVITY_003",

  // Validation Errors (4000-4099)
  REQUIRED_FIELD_MISSING = "VALIDATION_001",
  INVALID_EMAIL_FORMAT = "VALIDATION_002",
  INVALID_PHONE_FORMAT = "VALIDATION_003",
  INVALID_JSON_PAYLOAD = "VALIDATION_004",
  FIELD_LENGTH_EXCEEDED = "VALIDATION_005",

  // Authentication & Authorization (4100-4199)
  UNAUTHORIZED_ACCESS = "AUTH_001",
  INVALID_API_KEY = "AUTH_002",
  PERMISSION_DENIED = "AUTH_003",
  SESSION_INVALID = "AUTH_004",

  // External Service Errors (5500-5599)
  MAILGUN_API_ERROR = "EXTERNAL_001",
  FLEXPATH_API_ERROR = "EXTERNAL_002",
  OPENAI_API_ERROR = "EXTERNAL_003",
  DEALER_CRM_API_ERROR = "EXTERNAL_004",
  WEBHOOK_DELIVERY_FAILED = "EXTERNAL_005",

  // Database Errors (5600-5699)
  DATABASE_CONNECTION_FAILED = "DB_001",
  DATABASE_QUERY_FAILED = "DB_002",
  DATABASE_TRANSACTION_FAILED = "DB_003",
  DATABASE_CONSTRAINT_VIOLATION = "DB_004",

  // Rate Limiting (4290-4299)
  RATE_LIMIT_EXCEEDED = "RATE_001",
  TOO_MANY_REQUESTS = "RATE_002",

  // Generic Errors
  INTERNAL_SERVER_ERROR = "GENERIC_001",
  NOT_FOUND = "GENERIC_002",
  BAD_REQUEST = "GENERIC_003",
  METHOD_NOT_ALLOWED = "GENERIC_004",
}

export interface ErrorDefinition {
  code: ErrorCode;
  httpStatus: number;
  message: string;
  category: string;
  retryable: boolean;
  logLevel: "error" | "warn" | "info";
}

export const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
  // System Errors
  [ErrorCode.SYSTEM_HEALTH_CHECK_FAILED]: {
    code: ErrorCode.SYSTEM_HEALTH_CHECK_FAILED,
    httpStatus: 503,
    message: "System health check failed",
    category: "system",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.SYSTEM_STATS_UNAVAILABLE]: {
    code: ErrorCode.SYSTEM_STATS_UNAVAILABLE,
    httpStatus: 503,
    message: "System statistics temporarily unavailable",
    category: "system",
    retryable: true,
    logLevel: "warn",
  },
  [ErrorCode.MEMORY_USAGE_HIGH]: {
    code: ErrorCode.MEMORY_USAGE_HIGH,
    httpStatus: 503,
    message: "System memory usage critically high",
    category: "system",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    code: ErrorCode.SERVICE_UNAVAILABLE,
    httpStatus: 503,
    message: "Service temporarily unavailable",
    category: "system",
    retryable: true,
    logLevel: "error",
  },

  // Agent Errors
  [ErrorCode.AGENT_STATUS_FETCH_FAILED]: {
    code: ErrorCode.AGENT_STATUS_FETCH_FAILED,
    httpStatus: 500,
    message: "Failed to retrieve agent status information",
    category: "agent",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.AGENT_INITIALIZATION_FAILED]: {
    code: ErrorCode.AGENT_INITIALIZATION_FAILED,
    httpStatus: 500,
    message: "Agent initialization failed",
    category: "agent",
    retryable: false,
    logLevel: "error",
  },
  [ErrorCode.AGENT_COMMUNICATION_ERROR]: {
    code: ErrorCode.AGENT_COMMUNICATION_ERROR,
    httpStatus: 502,
    message: "Communication error with AI agent",
    category: "agent",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.AGENT_CONFIGURATION_INVALID]: {
    code: ErrorCode.AGENT_CONFIGURATION_INVALID,
    httpStatus: 500,
    message: "Agent configuration is invalid",
    category: "agent",
    retryable: false,
    logLevel: "error",
  },

  // Data Processing Errors
  [ErrorCode.LEAD_PROCESSING_FAILED]: {
    code: ErrorCode.LEAD_PROCESSING_FAILED,
    httpStatus: 500,
    message: "Lead processing operation failed",
    category: "data",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.BULK_CAMPAIGN_FAILED]: {
    code: ErrorCode.BULK_CAMPAIGN_FAILED,
    httpStatus: 500,
    message: "Bulk email campaign processing failed",
    category: "data",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.WEBHOOK_PROCESSING_FAILED]: {
    code: ErrorCode.WEBHOOK_PROCESSING_FAILED,
    httpStatus: 500,
    message: "Webhook data processing failed",
    category: "data",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.INVALID_DATA_FORMAT]: {
    code: ErrorCode.INVALID_DATA_FORMAT,
    httpStatus: 400,
    message: "Data format is invalid or unsupported",
    category: "validation",
    retryable: false,
    logLevel: "warn",
  },
  [ErrorCode.DATA_VALIDATION_FAILED]: {
    code: ErrorCode.DATA_VALIDATION_FAILED,
    httpStatus: 400,
    message: "Data validation failed",
    category: "validation",
    retryable: false,
    logLevel: "warn",
  },

  // Email Campaign Errors
  [ErrorCode.EMAIL_DELIVERY_FAILED]: {
    code: ErrorCode.EMAIL_DELIVERY_FAILED,
    httpStatus: 502,
    message: "Email delivery failed",
    category: "email",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.EMAIL_TEMPLATE_INVALID]: {
    code: ErrorCode.EMAIL_TEMPLATE_INVALID,
    httpStatus: 400,
    message: "Email template is invalid",
    category: "email",
    retryable: false,
    logLevel: "warn",
  },
  [ErrorCode.EMAIL_RECIPIENT_INVALID]: {
    code: ErrorCode.EMAIL_RECIPIENT_INVALID,
    httpStatus: 400,
    message: "Email recipient address is invalid",
    category: "email",
    retryable: false,
    logLevel: "warn",
  },
  [ErrorCode.EMAIL_CAMPAIGN_CREATION_FAILED]: {
    code: ErrorCode.EMAIL_CAMPAIGN_CREATION_FAILED,
    httpStatus: 500,
    message: "Email campaign creation failed",
    category: "email",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.EMAIL_SETTINGS_INVALID]: {
    code: ErrorCode.EMAIL_SETTINGS_INVALID,
    httpStatus: 400,
    message: "Email settings configuration is invalid",
    category: "email",
    retryable: false,
    logLevel: "warn",
  },

  // Activity & Logging Errors
  [ErrorCode.ACTIVITY_FETCH_FAILED]: {
    code: ErrorCode.ACTIVITY_FETCH_FAILED,
    httpStatus: 500,
    message: "Failed to retrieve activity data",
    category: "activity",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.ACTIVITY_CREATION_FAILED]: {
    code: ErrorCode.ACTIVITY_CREATION_FAILED,
    httpStatus: 500,
    message: "Failed to create activity record",
    category: "activity",
    retryable: true,
    logLevel: "warn",
  },
  [ErrorCode.LOG_WRITE_FAILED]: {
    code: ErrorCode.LOG_WRITE_FAILED,
    httpStatus: 500,
    message: "Failed to write log entry",
    category: "activity",
    retryable: true,
    logLevel: "warn",
  },

  // Validation Errors
  [ErrorCode.REQUIRED_FIELD_MISSING]: {
    code: ErrorCode.REQUIRED_FIELD_MISSING,
    httpStatus: 400,
    message: "Required field is missing",
    category: "validation",
    retryable: false,
    logLevel: "warn",
  },
  [ErrorCode.INVALID_EMAIL_FORMAT]: {
    code: ErrorCode.INVALID_EMAIL_FORMAT,
    httpStatus: 400,
    message: "Email address format is invalid",
    category: "validation",
    retryable: false,
    logLevel: "warn",
  },
  [ErrorCode.INVALID_PHONE_FORMAT]: {
    code: ErrorCode.INVALID_PHONE_FORMAT,
    httpStatus: 400,
    message: "Phone number format is invalid",
    category: "validation",
    retryable: false,
    logLevel: "warn",
  },
  [ErrorCode.INVALID_JSON_PAYLOAD]: {
    code: ErrorCode.INVALID_JSON_PAYLOAD,
    httpStatus: 400,
    message: "JSON payload is malformed",
    category: "validation",
    retryable: false,
    logLevel: "warn",
  },
  [ErrorCode.FIELD_LENGTH_EXCEEDED]: {
    code: ErrorCode.FIELD_LENGTH_EXCEEDED,
    httpStatus: 400,
    message: "Field length exceeds maximum allowed",
    category: "validation",
    retryable: false,
    logLevel: "warn",
  },

  // Authentication & Authorization
  [ErrorCode.UNAUTHORIZED_ACCESS]: {
    code: ErrorCode.UNAUTHORIZED_ACCESS,
    httpStatus: 401,
    message: "Unauthorized access",
    category: "auth",
    retryable: false,
    logLevel: "warn",
  },
  [ErrorCode.INVALID_API_KEY]: {
    code: ErrorCode.INVALID_API_KEY,
    httpStatus: 401,
    message: "Invalid API key",
    category: "auth",
    retryable: false,
    logLevel: "warn",
  },
  [ErrorCode.PERMISSION_DENIED]: {
    code: ErrorCode.PERMISSION_DENIED,
    httpStatus: 403,
    message: "Permission denied",
    category: "auth",
    retryable: false,
    logLevel: "warn",
  },
  [ErrorCode.SESSION_INVALID]: {
    code: ErrorCode.SESSION_INVALID,
    httpStatus: 401,
    message: "Session is invalid or has expired",
    category: "auth",
    retryable: false,
    logLevel: "info",
  },

  // External Service Errors
  [ErrorCode.MAILGUN_API_ERROR]: {
    code: ErrorCode.MAILGUN_API_ERROR,
    httpStatus: 502,
    message: "Mailgun API error",
    category: "external",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.FLEXPATH_API_ERROR]: {
    code: ErrorCode.FLEXPATH_API_ERROR,
    httpStatus: 502,
    message: "FlexPath API error",
    category: "external",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.OPENAI_API_ERROR]: {
    code: ErrorCode.OPENAI_API_ERROR,
    httpStatus: 502,
    message: "OpenAI API error",
    category: "external",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.DEALER_CRM_API_ERROR]: {
    code: ErrorCode.DEALER_CRM_API_ERROR,
    httpStatus: 502,
    message: "Dealer CRM API error",
    category: "external",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.WEBHOOK_DELIVERY_FAILED]: {
    code: ErrorCode.WEBHOOK_DELIVERY_FAILED,
    httpStatus: 502,
    message: "Webhook delivery failed",
    category: "external",
    retryable: true,
    logLevel: "error",
  },

  // Database Errors
  [ErrorCode.DATABASE_CONNECTION_FAILED]: {
    code: ErrorCode.DATABASE_CONNECTION_FAILED,
    httpStatus: 503,
    message: "Database connection failed",
    category: "database",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.DATABASE_QUERY_FAILED]: {
    code: ErrorCode.DATABASE_QUERY_FAILED,
    httpStatus: 500,
    message: "Database query failed",
    category: "database",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.DATABASE_TRANSACTION_FAILED]: {
    code: ErrorCode.DATABASE_TRANSACTION_FAILED,
    httpStatus: 500,
    message: "Database transaction failed",
    category: "database",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.DATABASE_CONSTRAINT_VIOLATION]: {
    code: ErrorCode.DATABASE_CONSTRAINT_VIOLATION,
    httpStatus: 400,
    message: "Database constraint violation",
    category: "database",
    retryable: false,
    logLevel: "warn",
  },

  // Rate Limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    httpStatus: 429,
    message: "Rate limit exceeded",
    category: "rate_limit",
    retryable: true,
    logLevel: "warn",
  },
  [ErrorCode.TOO_MANY_REQUESTS]: {
    code: ErrorCode.TOO_MANY_REQUESTS,
    httpStatus: 429,
    message: "Too many requests",
    category: "rate_limit",
    retryable: true,
    logLevel: "warn",
  },

  // Generic Errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: {
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    httpStatus: 500,
    message: "Internal server error",
    category: "generic",
    retryable: true,
    logLevel: "error",
  },
  [ErrorCode.NOT_FOUND]: {
    code: ErrorCode.NOT_FOUND,
    httpStatus: 404,
    message: "Resource not found",
    category: "generic",
    retryable: false,
    logLevel: "info",
  },
  [ErrorCode.BAD_REQUEST]: {
    code: ErrorCode.BAD_REQUEST,
    httpStatus: 400,
    message: "Bad request",
    category: "generic",
    retryable: false,
    logLevel: "warn",
  },
  [ErrorCode.METHOD_NOT_ALLOWED]: {
    code: ErrorCode.METHOD_NOT_ALLOWED,
    httpStatus: 405,
    message: "Method not allowed",
    category: "generic",
    retryable: false,
    logLevel: "warn",
  },
};

export function getErrorDefinition(code: ErrorCode): ErrorDefinition {
  return ERROR_DEFINITIONS[code];
}

export function getErrorsByCategory(category: string): ErrorDefinition[] {
  return Object.values(ERROR_DEFINITIONS).filter(def => def.category === category);
}
