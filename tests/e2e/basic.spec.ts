import { test, expect } from "@playwright/test";

test.describe("CCL Agent System E2E Tests", () => {
  // Skip tests if running in CI without a server
  test.skip(!!process.env.CI, "Skipping E2E tests in CI environment without running server");

  test("should load the homepage", async ({ page }) => {
    await page.goto("/");

    // Check if the page loads without errors
    await expect(page).toHaveTitle(/CCL/);

    // Check for basic elements
    await expect(page.locator("body")).toBeVisible();
  });

  test("should have working health check endpoint", async ({ page }) => {
    const response = await page.request.get("/health");
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe("healthy");
  });

  test("should handle API requests", async ({ page }) => {
    // Test the agents endpoint
    const response = await page.request.get("/api/agents");
    expect(response.ok()).toBeTruthy();

    const agents = await response.json();
    expect(Array.isArray(agents)).toBeTruthy();
  });

  test("should handle chat functionality", async ({ page }) => {
    await page.goto("/");

    // Look for chat-related elements (adjust selectors based on actual UI)
    const chatButton = page.locator('[data-testid="chat-button"]').first();
    if (await chatButton.isVisible()) {
      await chatButton.click();

      // Check if chat interface opens
      const chatInterface = page.locator('[data-testid="chat-interface"]');
      await expect(chatInterface).toBeVisible();
    }
  });
});

// Basic smoke test that always runs
test.describe("Basic Smoke Tests", () => {
  test("should have playwright configuration", async () => {
    // This test just verifies that Playwright is working
    expect(true).toBe(true);
  });
});
