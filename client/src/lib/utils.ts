import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ApiError {
  success?: boolean;
  message: string;
  timestamp?: string;
  code?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ClientError extends Error {
  public readonly code?: string;
  public readonly statusCode?: number;

  constructor(message: string, code?: string, statusCode?: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'ClientError';
  }
}

export const handleApiError = (error: any): ClientError => {
  // Handle fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new ClientError('Network error. Please check your connection and try again.', 'NETWORK_ERROR');
  }

  // Handle API errors
  if (error.response) {
    const { status, data } = error.response;
    const message = data?.message || data?.error || 'An error occurred';
    return new ClientError(message, data?.code, status);
  }

  // Handle generic errors
  if (error instanceof Error) {
    return new ClientError(error.message, 'GENERIC_ERROR');
  }

  return new ClientError('An unexpected error occurred', 'UNKNOWN_ERROR');
};

export const apiRequest = async <T = any>(
  url: string, 
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ClientError(
        data.message || data.error || 'Request failed',
        data.code,
        response.status
      );
    }

    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const formatError = (error: unknown): string => {
  if (error instanceof ClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
};

export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
};