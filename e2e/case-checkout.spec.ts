import type { Page } from "@playwright/test";

import { expect, seedCoverageDraft, test } from "./support/journey-test";

async function openReadyCheckout(page: Page) {
  await seedCoverageDraft(page);
  await page.goto("/cases/new");
  await expect(page.getByRole("heading", { name: "Your evidence coverage is ready." })).toBeVisible();
  await page.getByRole("button", { name: /Sign in & continue/ }).click();
  await expect(page.getByRole("button", { name: "Continue to secure checkout" })).toBeEnabled();
}

test.describe("Case checkout", () => {
  test("confirms a Case-scoped local payment without leaving the loopback origin", async ({ page, apiScenario }) => {
    await openReadyCheckout(page);
    await page.getByRole("button", { name: "Continue to secure checkout" }).click();
    await expect.poll(() => apiScenario.snapshot().checkoutUnlocked).toBe(true);
    expect(new URL(page.url()).origin).toBe("http://127.0.0.1:3100");
  });

  test.describe("cancelled provider handoff", () => {
    test.use({ scenarioOptions: { checkout: "cancelled" } });
    test("returns to the saved Case without charging", async ({ page }) => {
      await openReadyCheckout(page);
      await page.getByRole("button", { name: "Continue to secure checkout" }).click();
      await expect(page.getByText("Checkout was cancelled. Your Case is still saved and nothing was charged.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue to secure checkout" })).toBeEnabled();
    });
  });

  test.describe("provider failure", () => {
    test.use({ scenarioOptions: { checkout: "provider_error" } });
    test("keeps the retry action available", async ({ page }) => {
      await openReadyCheckout(page);
      await page.getByRole("button", { name: "Continue to secure checkout" }).click();
      await expect(page.getByText("Secure checkout is temporarily unavailable.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue to secure checkout" })).toBeEnabled();
    });
  });
});
