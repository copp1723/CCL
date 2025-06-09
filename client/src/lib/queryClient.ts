import { QueryClient, QueryFunction } from "@tanstack/react-query";
import type { ApiResponse } from "@shared/api-types";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = any>(
  url: string,
  options?: {
    method?: string;
    data?: unknown;
  }
): Promise<T> {
  const { method = "GET", data } = options || {};

  const headers: Record<string, string> = {};

  // Only add API key for protected endpoints
  if (url.includes("/api/system/")) {
    const apiKey = import.meta.env.VITE_CCL_API_KEY;
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }
  }

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    const url = queryKey[0] as string;

    // Only add API key for protected endpoints
    if (url.includes("/api/system/")) {
      const apiKey = import.meta.env.VITE_CCL_API_KEY;
      if (apiKey) {
        headers["x-api-key"] = apiKey;
      }
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
