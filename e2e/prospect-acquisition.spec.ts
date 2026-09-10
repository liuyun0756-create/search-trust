import { expect, test, completeProspectAcquisition } from "./support/journey-test";

test.describe("prospect acquisition", () => {
  test("completes public preflight with one confirmed competitor", async ({ page, apiScenario }) => {
    await completeProspectAcquisition(page, 1);
    await expect(page.getByText("1 confirmed")).toBeVisible();
    await expect(page.getByText("Limited coverage")).toBeVisible();
    expect(apiScenario.snapshot().discoveryPoll).toBeGreaterThanOrEqual(2);
  });

  test.describe("when discovery finds no competitor", () => {
    test.use({ scenarioOptions: { competitors: "zero" } });

    test("blocks progress until the user supplies at least one", async ({ page, apiScenario }) => {
      await page.goto("/cases/new");
      await page.getByLabel("Client website").fill("searchtrust-e2e.example.invalid");
      await page.getByRole("button", { name: /Run free preflight/ }).click();
      await page.getByRole("button", { name: /Confirm & find competitors/ }).click();

      await expect(page.getByRole("heading", { name: "At least one competitor is required" })).toBeVisible({ timeout: 12_000 });
      await expect(page.getByRole("button", { name: /Add and validate one competitor/ })).toBeDisabled();
      await page.getByLabel(/Add known competitor websites/).fill("known-competitor.searchtrust-e2e.example.invalid");
      await expect(page.getByRole("button", { name: "Validate & rerun" })).toBeEnabled();
      expect(apiScenario.snapshot().discoveryPoll).toBeGreaterThanOrEqual(2);
    });
  });
});
