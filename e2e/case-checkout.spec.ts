import { expect, openProspectStart, test } from "./support/journey-test";

test.describe("Prospect credit boundary", () => {
  test("reserves exactly one account credit before provider-backed discovery", async ({ page, apiScenario }) => {
    await openProspectStart(page);
    const start = page.getByRole("button", { name: "Start analysis · uses 1 credit" });
    await expect(start).toBeEnabled();
    await start.click();

    await expect(page.getByRole("heading", { name: "Choose the real competitive set." })).toBeVisible({ timeout: 12_000 });
    expect(apiScenario.snapshot()).toMatchObject({
      prospectWorkflowId: expect.any(String),
      verifiedBalance: 0,
    });
  });

  test.describe("without an available credit", () => {
    test.use({ scenarioOptions: { verifiedBalance: 0 } });

    test("blocks provider discovery and offers a one-credit purchase", async ({ page, apiScenario }) => {
      await openProspectStart(page);
      await expect(page.getByRole("link", { name: "Buy 1 credit · $19" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Start analysis · uses 1 credit" })).toHaveCount(0);
      expect(apiScenario.snapshot()).toMatchObject({ prospectWorkflowId: null, discoveryPoll: 0, verifiedBalance: 0 });
    });
  });

  test.describe("when the discovery provider fails", () => {
    test.use({ scenarioOptions: { competitors: "failure" } });

    test("keeps a retry path without charging a second credit", async ({ page, apiScenario }) => {
      await openProspectStart(page);
      const start = page.getByRole("button", { name: "Start analysis · uses 1 credit" });
      await expect(start).toBeEnabled();
      await start.click();

      await expect(page.getByRole("heading", { name: "Competitor discovery needs attention" })).toBeVisible({ timeout: 12_000 });
      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      expect(apiScenario.snapshot().verifiedBalance).toBe(0);
    });
  });
});
