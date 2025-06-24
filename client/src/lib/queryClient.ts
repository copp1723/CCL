import { QueryClient, QueryFunction } from "@tanstack/react-query";
// ApiResponse is not used in this file, consider removing if not needed elsewhere via this export
// import type { ApiResponse } from "@shared/api-types";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorText = res.statusText;
    try {
      // Attempt to parse error response from API, which might be JSON
      const errorBody = await res.json();
      errorText = errorBody?.error?.message || errorBody?.message || errorText;
    } catch (e) {
      // If parsing fails, fallback to text or statusText
      try {
        errorText = (await res.text()) || errorText;
      } catch (e2) {
        // ignore
      }
    }
    throw new Error(`${res.status}: ${errorText}`);
  }
}

export interface ApiRequestOptions {
  method?: string;
  data?: unknown;
  customHeaders?: Record<string, string>;
  includeApiKey?: boolean; // If true, uses VITE_CCL_API_KEY
  token?: string; // For bearer token auth if needed in the future
}

export async function apiRequest<T = any>(url: string, options?: ApiRequestOptions): Promise<T> {
  const { method = "GET", data, customHeaders, includeApiKey, token } = options || {};

  const headers: Record<string, string> = { ...customHeaders };

  if (includeApiKey) {
    const apiKey = import.meta.env.VITE_CCL_API_KEY;
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    } else {
      console.warn("VITE_CCL_API_KEY is not set but includeApiKey was true for URL:", url);
    }
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (data) {
    // Ensure Content-Type is not overwritten if already set in customHeaders
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: "include", // Important for cookies if any
  };

  if (data) {
    fetchOptions.body = JSON.stringify(data);
  }

  const res = await fetch(url, fetchOptions);

  await throwIfResNotOk(res);

  // Handle cases where response might be empty (e.g., 204 No Content)
  const contentType = res.headers.get("content-type");
  if (res.status === 204 || !contentType || !contentType.includes("application/json")) {
    return undefined as T; // Or handle as appropriate for your app, e.g. return null or a specific type
  }

  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";

// Updated getQueryFn to potentially use the new apiRequest or simplify
export const getQueryFn: <T>(options?: {
  on401?: UnauthorizedBehavior;
  includeApiKey?: boolean;
}) => QueryFunction<T> =
  queryOptions =>
  async ({ queryKey }) => {
    const { on401 = "throw", includeApiKey = false } = queryOptions || {};
    const url = queryKey[0] as string;

    // Determine if this specific URL pattern needs an API key by default for queryFn
    // For example, keep the /api/system/ check or make it more configurable
    const autoIncludeApiKeyForSystem = url.includes("/api/system/");

    try {
      return await apiRequest<T>(url, {
        method: "GET",
        includeApiKey: includeApiKey || autoIncludeApiKeyForSystem,
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("401") && on401 === "returnNull") {
        return null as T; // Cast to T, assuming null is a valid state for T
      }
      throw error; // Re-throw other errors or if on401 is "throw"
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
