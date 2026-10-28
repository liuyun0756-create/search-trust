import { expect, test } from "./support/journey-test";

test("marketing navigation uses consistent labels and a visible current-page marker", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/use-cases");
  await expect(
    page
      .getByRole("banner")
      .getByRole("button", { name: "Start a Case", exact: true }),
  ).toBeVisible();

  const desktop = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(desktop.getByRole("link")).toHaveText([
    "Home",
    "Method",
    "Sample Reports",
    "Client Scenarios",
    "Pricing",
  ]);
  const active = desktop.getByRole("link", { name: "Client Scenarios" });
  await expect(active).toHaveAttribute("aria-current", "page");
  await expect(active).toHaveCSS("background-color", "rgb(232, 243, 229)");
  await expect(active.locator('span[aria-hidden="true"]')).toBeVisible();
  await active.focus();
  await expect(active).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const mobile = page.getByRole("navigation", { name: "Mobile navigation" });
  const mobileActive = mobile.getByRole("link", { name: "Client Scenarios" });
  await expect(mobileActive).toHaveAttribute("aria-current", "page");
  await expect(mobileActive.locator('span[aria-hidden="true"]')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
