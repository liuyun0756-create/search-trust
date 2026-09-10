import { expect, test as base, type Page } from "@playwright/test";

import { E2E_IDS } from "../fixtures/ids";
import { discoveryStatusFixture, E2E_BUSINESS, E2E_MARKET, E2E_NOW, preflightFixture } from "../fixtures/preflight";
import { installLocalApiRouter, LocalApiScenario, type LocalApiScenarioOptions } from "./api-router";
import { installExternalRequestGuard } from "./external-request-guard";

type JourneyFixtures = {
  scenarioOptions: LocalApiScenarioOptions;
  apiScenario: LocalApiScenario;
};

export const test = base.extend<JourneyFixtures>({
  scenarioOptions: [{}, { option: true }],
  apiScenario: [
    async ({ page, baseURL, scenarioOptions }, use) => {
      if (!baseURL) throw new Error("The local journey requires a Playwright base URL.");
      const guard = await installExternalRequestGuard(page, baseURL);
      const scenario = await installLocalApiRouter(page, new LocalApiScenario(scenarioOptions));
      await use(scenario);
      guard.assertClean();
    },
    { auto: true },
  ],
});

export { expect };

export async function completeProspectAcquisition(page: Page, selectedCompetitors = 1): Promise<void> {
  await page.goto("/cases/new");
  await page.getByLabel("Client website").fill("searchtrust-e2e.example.invalid");
  await page.getByRole("button", { name: /Run free preflight/ }).click();
  await expect(page.getByRole("heading", { name: "Confirm the business match." })).toBeVisible();
  await page.getByRole("button", { name: /Confirm & find competitors/ }).click();
  await expect(page.getByRole("heading", { name: "Choose the real competitive set." })).toBeVisible({ timeout: 12_000 });

  const candidates = page.getByRole("checkbox");
  await expect(candidates).toHaveCount(3);
  for (let index = selectedCompetitors; index < 3; index += 1) {
    if (await candidates.nth(index).isChecked()) {
      await page.getByText(`Synthetic Competitor ${index + 1}`, { exact: true }).click();
    }
  }
  await page.getByRole("button", { name: /Confirm competitors/ }).click();
  await expect(page.getByRole("heading", { name: "Your evidence coverage is ready." })).toBeVisible();
}

export async function seedCoverageDraft(page: Page): Promise<void> {
  const discovery = discoveryStatusFixture("succeeded");
  const draft = {
    schema_version: "2.2-new-case-v1",
    created_at: E2E_NOW,
    updated_at: E2E_NOW,
    expires_at: "2099-09-11T08:00:00.000Z",
    stage: "coverage",
    goal: "win_new_client",
    draft_case_id: E2E_IDS.caseId,
    site_url: E2E_IDS.siteUrl,
    gbp_url: E2E_IDS.gbpUrl,
    preflight: preflightFixture,
    preflight_error: null,
    business_confirmation: { business_identity: E2E_BUSINESS, primary_service: "Emergency plumbing", target_market: E2E_MARKET },
    discovery_job_id: E2E_IDS.discoveryJobId,
    discovery_idempotency_key: `discover:${E2E_IDS.caseId}:${E2E_IDS.discoveryJobId}`,
    discovery_status: discovery,
    discovery_error: null,
    supplemental_website_urls: [],
    selected_competitor_ids: [E2E_IDS.competitorIds[0]],
    analysis_job_id: null,
    analysis_idempotency_key: null,
    previous_analysis_job_id: null,
  };
  await page.addInitScript(({ value }) => {
    const key = "searchtrust:v2.2:new-case-draft";
    if (!window.sessionStorage.getItem(key)) {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    }
  }, { value: draft });
}
