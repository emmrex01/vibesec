import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. Run against a local dev server connected to a TEST Supabase project.
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are required for the admin specs.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
