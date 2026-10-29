import { E2E_IDS } from "./fixtures/ids";
import { analysisStatusFixture } from "./fixtures/report";
import { expect, seedCoverageDraft, test } from "./support/journey-test";

test.describe("prospect report generation", () => {
  test.use({ scenarioOptions: { analysis: "interrupted", prospectRecovery: "reserved" } });

  test("recovers from a stream interruption and renders exactly three actions", async ({ page, apiScenario }) => {
    await seedCoverageDraft(page);
    await page.goto("/cases/new");
    await page.getByRole("button", { name: /Generate Prospect report/ }).click();

    await expect(page).toHaveURL(new RegExp(`/cases/${E2E_IDS.caseId}/reports/${E2E_IDS.reportId}`), { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Example Plumbing" })).toBeVisible();
    await expect(page.locator("section#actions details")).toHaveCount(3);
    expect(apiScenario.snapshot().analysisPoll).toBeGreaterThanOrEqual(2);
  });
});


test.describe("existing paid workflow refresh", () => {
  test.use({ scenarioOptions: { analysis: "interrupted", prospectRecovery: "running" } });
  test("restores a different temporary draft to the original Case and report without mutations", async ({ page, apiScenario }) => {
    const mutations: string[] = [];
    page.on("request", request => {
      if (request.url().includes("/api/") && !["GET", "HEAD"].includes(request.method())) mutations.push(`${request.method()} ${request.url()}`);
    });
    const balance = apiScenario.snapshot().verifiedBalance;
    let allowComplete = false;
    await page.route(`**/api/v2/tasks/${E2E_IDS.analysisJobId}`, async route => {
      if (allowComplete) return route.fallback();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(analysisStatusFixture("running")) });
    });
    await seedCoverageDraft(page, { draft_case_id: "e2000000-0000-4000-8000-000000000099", stage: "auth_handoff",
      analysis_job_id: E2E_IDS.analysisJobId, analysis_idempotency_key: "original-reserved-analysis" });
    await page.goto("/cases/new");
    await expect(page.getByText(`Case ${E2E_IDS.caseId}`, { exact: true })).toBeVisible();
    allowComplete = true;
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/cases/${E2E_IDS.caseId}/reports/${E2E_IDS.reportId}`), { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Example Plumbing" })).toBeVisible();
    expect(apiScenario.snapshot().verifiedBalance).toBe(balance);
    expect(mutations).toEqual([]);
  });
});
