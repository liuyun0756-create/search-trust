import { expect, test } from "./support/journey-test";

test.describe("Client Scenarios report previews", () => {
  test("shows concrete prospect and verified outcomes with separate evidence", async ({ page }) => {
    await page.goto("/use-cases");
    const reports = page.getByRole("region", { name: "Two report outcomes" }).locator("article");
    await expect(reports).toHaveCount(2);
    await expect(reports.first()).toContainText("Fast, reliable cooling solutions");
    await expect(reports.first()).toContainText("Is AC repair a current priority");
    await expect(reports.first()).not.toContainText("12,400");
    await expect(reports.first()).not.toContainText("Google Search Console");
    await expect(reports.last()).toContainText("12,400 impressions and 310 clicks");
    await expect(reports.last()).toContainText("Aug 31–Sep 27, 2026");

    await expect(page.getByText("E01", { exact: true })).toBeVisible();
    await expect(page.getByText("E05", { exact: true })).toBeVisible();
    await expect(page.getByText("Make the opening specific.")).toBeVisible();
    await expect(page.getByText("Check the mobile path.")).toBeVisible();
    await expect(page.getByRole("tabpanel", { name: "Client view" })).toContainText("Whether qualified enquiries improve requires follow-up evidence");
    await expect(page.getByRole("link", { name: /View the complete sample reports/ })).toHaveAttribute("href", "/sample-report");
    await expect(page.getByRole("heading", { name: "The division of work" })).toHaveCount(0);

    await reports.first().getByRole("link", { name: /Explore prospect situations/ }).click();
    await expect(page.getByTestId("practice-scene-first-conversation")).toHaveAttribute("aria-hidden", "false");
    await expect(page).toHaveURL(/#practice-first-conversation$/);
    await reports.last().getByRole("link", { name: /Explore ongoing client work/ }).click();
    await expect(page.getByTestId("practice-scene-revisit-recommendation")).toHaveAttribute("aria-hidden", "false");
    await expect(page).toHaveURL(/#practice-revisit-recommendation$/);
  });

  test("switches client and SEO reading views without changing a story or sending business mutations", async ({ page }) => {
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && /\/api\/(cases|reports|billing|credits)/.test(request.url())) {
        mutations.push(`${request.method()} ${request.url()}`);
      }
    });
    await page.goto("/use-cases#practice-competitor-question");
    await page.waitForLoadState("networkidle");
    const tabs = page.getByRole("tablist", { name: "Report delivery audience" }).getByRole("tab");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "SEO view" })).toBeHidden();
    await tabs.first().focus();
    await tabs.first().press("ArrowRight");
    await expect(tabs.last()).toBeFocused();
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "SEO view" })).toContainText("12,400 impressions · 310 clicks · 2.5% CTR");
    await tabs.last().press("Home");
    await expect(tabs.first()).toBeFocused();
    await expect(page.getByRole("tabpanel", { name: "Client view" })).toBeVisible();
    await tabs.first().press("End");
    await expect(tabs.last()).toBeFocused();
    await tabs.first().click();
    await expect(page.getByTestId("practice-scene-competitor-question")).toHaveAttribute("aria-hidden", "false");
    await expect(page).toHaveURL(/#practice-competitor-question$/);
    expect(mutations).toEqual([]);
  });

  test("keeps reports readable without horizontal page overflow at five widths and 200% zoom", async ({ page }) => {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/use-cases");
      await expect(page.getByRole("region", { name: "Two report outcomes" })).toBeVisible();
      await expect(page.getByRole("tabpanel", { name: "Client view" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${width}px overflow`).toBeLessThanOrEqual(1);
      const cards = page.getByRole("region", { name: "Two report outcomes" }).locator("article");
      const first = await cards.first().boundingBox();
      const second = await cards.last().boundingBox();
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      if (first && second && width < 900) expect(second.y).toBeGreaterThan(first.y + first.height - 1);
    }
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/use-cases");
    await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "200% zoom overflow").toBeLessThanOrEqual(1);
  });
});
