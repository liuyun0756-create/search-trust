import { E2E_IDS } from "./fixtures/ids";
import { expect, test } from "./support/journey-test";

test("moves from healthy Verified Core sources to the verified change explanation", async ({ page }) => {
  await page.goto(`/cases/${E2E_IDS.caseId}/connections`);
  await expect(page.getByRole("progressbar", { name: "Verified Core sources ready" })).toHaveAttribute("aria-valuenow", "3");
  await expect(page.getByText("All required evidence is healthy and matched to this Case.")).toBeVisible();

  await page.goto(`/cases/${E2E_IDS.caseId}/reports/e2000000-0000-4000-8000-000000000016`);
  await expect(page.getByText("v2 · Verified")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What changed since the previous report." })).toBeVisible();
  await expect(page.locator("section#changes article")).not.toHaveCount(0);
});
