import { E2E_IDS } from "./fixtures/ids";
import { expect, test } from "./support/journey-test";

async function openManager(page: import("@playwright/test").Page) {
  await page.goto(`/cases/${E2E_IDS.caseId}/connections`);
  await page.getByText("Manage connections and resources").click();
  await expect(page.getByLabel("Google account")).toBeVisible();
}

test.describe("Google authorization and identity", () => {
  test("completes a synthetic authorization callback", async ({ page }) => {
    await openManager(page);
    await page.getByRole("button", { name: "Connect another Google account" }).click();
    await expect(page.getByRole("heading", { name: "Simulated Google consent" })).toBeVisible();
    await page.getByRole("link", { name: "Authorize" }).click();
    await expect(page).toHaveURL(/google_connection=success&code=AUTHORIZED/);
    await expect(page.getByText("All required evidence is healthy and matched to this Case.")).toBeVisible();
    await expect(page.locator('[data-source-key="public_gbp"], [data-source-key="gsc"], [data-source-key="ga4"]'))
      .toHaveCount(3);
  });

  test("models user denial without sending a Google request", async ({ page }) => {
    await openManager(page);
    await page.getByRole("button", { name: "Connect another Google account" }).click();
    await page.getByRole("link", { name: "Deny" }).click();
    await expect(page).toHaveURL(/google_connection=error&code=GOOGLE_AUTHORIZATION_DENIED/);
  });

  test.describe("identity mismatch", () => {
    test.use({ scenarioOptions: { google: "mismatch" } });
    test("refuses to save the conflicting resource", async ({ page }) => {
      await openManager(page);
      await page.locator("label").filter({ hasText: /^Data source/ }).locator("select").selectOption("ga4");
      await page.getByLabel("Google account").selectOption(E2E_IDS.connectionId);
      await page.getByRole("button", { name: "Find resources" }).click();
      await page.getByRole("button", { name: "Review selection" }).click();
      await expect(page.getByRole("button", { name: "Save this resource" })).toBeEnabled();
      await page.getByRole("button", { name: "Save this resource" }).click();
      await expect(page.getByText("Review the resource identity before saving.", { exact: true })).toBeVisible();
    });
  });
});
