import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./playwright-results",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  fullyParallel: true,

  reporter: [
    ["list"],
    ["junit", { outputFile: "playwright-results/results.xml" }],
    ["html",  { outputFolder: "playwright-results/html", open: "never" }],
  ],

  use: {
    baseURL:           process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
    trace:             "on-first-retry",
    screenshot:        "only-on-failure",
    video:             "on-first-retry",
    actionTimeout:     10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Start dev server locally (skipped in CI — server is pre-started)
  webServer: process.env.CI
    ? undefined
    : {
        command:           "npm run dev",
        url:               "http://localhost:5173",
        reuseExistingServer: true,
        timeout:           30_000,
      },
});
