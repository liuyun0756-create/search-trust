import { E2E_IDS } from "./fixtures/ids";
import { expect, seedCoverageDraft, test } from "./support/journey-test";

test.describe("prospect report generation", () => {
  test.use({ scenarioOptions: { analysis: "interrupted" } });

  test("recovers from a stream interruption and renders exactly three actions", async ({ page, apiScenario }) => {
    await seedCoverageDraft(page);
    await page.goto("/cases/new");
    await page.getByRole("button", { name: /Sign in & continue/ }).click();
    await page.getByRole("button", { name: "Continue to secure checkout" }).click();

    await expect(page).toHaveURL(new RegExp(`/cases/${E2E_IDS.caseId}/reports/${E2E_IDS.reportId}`), { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Example Plumbing" })).toBeVisible();
    await expect(page.locator("section#actions details")).toHaveCount(3);
    expect(apiScenario.snapshot().analysisPoll).toBeGreaterThanOrEqual(2);
  });
});
