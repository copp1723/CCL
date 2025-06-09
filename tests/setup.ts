import { beforeAll, afterAll, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Global test setup
beforeAll(() => {
  // Mock environment variables for tests
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
  process.env.JWT_SECRET = "test-secret";
  process.env.API_KEY = "test-api-key";
});

afterAll(() => {
  // Cleanup after all tests
});

// Mock fetch globally for tests
global.fetch = vi.fn();

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
})) as any;
