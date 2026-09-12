import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3101";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/public-entry-paused.spec.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  outputDir: "output/playwright-paused/test-results",
  reporter: [["line"]],
  use: {
    baseURL,
    locale: "en-US",
    timezoneId: "UTC",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [{ name: "paused-intake", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev:e2e:paused",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VERCEL_ENV: "",
      V22_PUBLIC_ENTRY_ENABLED: "false",
      NEXT_PUBLIC_E2E_TEST_MODE: "true",
      NEXT_PUBLIC_E2E_BASE_URL: baseURL,
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "",
    },
  },
});
