import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**", "tests/system-validation.test.js", "test-integration.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "coverage/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/tests/**",
        "**/test-*",
        "**/*.test.*",
        "**/*.spec.*",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./client/src"),
      "@server": resolve(__dirname, "./server"),
      "@shared": resolve(__dirname, "./shared"),
    },
  },
});
