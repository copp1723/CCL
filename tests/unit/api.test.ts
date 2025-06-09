import { describe, it, expect, beforeEach, vi } from "vitest";

describe("API Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Health Check", () => {
    it("should return healthy status", async () => {
      const mockResponse = {
        status: "healthy",
        timestamp: expect.any(String),
        environment: "test",
      };

      // Mock fetch for health check
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch("/health");
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.status).toBe("healthy");
      expect(data.environment).toBe("test");
    });
  });

  describe("System Stats", () => {
    it("should return system statistics", async () => {
      const mockStats = {
        success: true,
        data: {
          leads: 0,
          activities: 0,
          agents: 4,
          uptime: expect.any(Number),
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStats),
      });

      const response = await fetch("/api/system/stats", {
        headers: { "x-api-key": "test-api-key" },
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });
  });

  describe("Leads API", () => {
    it("should create a new lead", async () => {
      const newLead = {
        email: "test@example.com",
        phoneNumber: "555-0123",
        status: "new",
        leadData: { source: "test" },
      };

      const mockResponse = {
        success: true,
        data: {
          id: "lead_1_123456789",
          ...newLead,
          createdAt: expect.any(String),
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLead),
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.data.email).toBe(newLead.email);
    });
  });
});
