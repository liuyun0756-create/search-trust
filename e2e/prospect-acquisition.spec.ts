import { expect, test, completeProspectAcquisition, openProspectStart } from "./support/journey-test";

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
      await openProspectStart(page);
      const start = page.getByRole("button", { name: "Start analysis · uses 1 credit" });
      await expect(start).toBeEnabled();
      await start.click();

      await expect(page.getByRole("heading", { name: "At least one competitor is required" })).toBeVisible({ timeout: 12_000 });
      await expect(page.getByRole("button", { name: /Add and validate one competitor/ })).toBeDisabled();
      await page.getByLabel(/Add known competitor websites/).fill("known-competitor.searchtrust-e2e.example.invalid");
      await expect(page.getByRole("button", { name: "Validate & rerun" })).toBeEnabled();
      expect(apiScenario.snapshot().discoveryPoll).toBeGreaterThanOrEqual(2);
    });
  });
});
