import {defineConfig} from "@playwright/test";
import base from "./playwright.config";

// These suites intercept every browser request and mount actual components.
// They need neither a Next server nor live auth/provider configuration.
export default defineConfig({...base,webServer:undefined,
  testMatch:["**/capability-database-journey.spec.ts","**/first-service-full-journey.spec.ts","**/comparison-checks.spec.ts","**/page-checks.spec.ts","**/implementation-attachments.spec.ts","**/ga4-session-reading.spec.ts"],
  outputDir:"output/playwright/integration-results",
  reporter:[["line"],["html",{outputFolder:"output/playwright/integration-report",open:"never"}]],
});
