import type { Page } from "@playwright/test";
import { expect, test } from "./support/journey-test";

async function openMethod(page: Page, path = "/framework") {
  await page.goto(path);
  // This label appears after the local identity provider's hydration effect.
  await expect(
    page
      .getByRole("banner")
      .getByRole("button", { name: "Start a Case", exact: true }),
  ).toBeVisible();
}

test.describe("method evidence guide", () => {
  test("keeps the reading sequence, reachable chapters and real entry destinations", async ({
    page,
  }) => {
    await openMethod(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Build the proposal around the business.",
    );
    const sections = [
      "method-conversations",
      "method-pipeline",
      "method-scope",
      "prospect-diagnosis",
      "prioritization-title",
      "execution-title",
      "delivery-title",
      "method-situations",
    ];
    let previous = -1;
    for (const id of sections) {
      const y = await page
        .locator(`#${id}`)
        .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
      expect(y).toBeGreaterThan(previous);
      previous = y;
    }
    await page
      .getByRole("navigation", { name: "Our Method chapters" })
      .getByRole("link", { name: /Follow a decision/ })
      .click();
    await expect(page).toHaveURL(/#prospect-diagnosis$/);
    expect(
      (await page.locator("#prospect-diagnosis").boundingBox())!.y,
    ).toBeGreaterThanOrEqual(120);
    await expect(
      page.getByText(/Not found does not mean missing/),
    ).toBeVisible();
    await expect(
      page.getByText("Client-ready Review", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Continue with an existing Case" }),
    ).toHaveAttribute("href", "/cases/service");
    await page
      .getByRole("link", { name: "Read both full report samples" })
      .click();
    await expect(page).toHaveURL(/\/sample-report$/);
    await openMethod(page);
    await page
      .getByRole("button", { name: "Start a Prospect Case", exact: true })
      .click();
    await expect(page).toHaveURL(/\/cases\/new$/);
  });

  test("offers six selectable situations after the five method chapters", async ({
    page,
  }) => {
    await openMethod(page, "/framework#method-situations");
    const tabs = page
      .getByRole("tablist", { name: "Choose a method situation" })
      .getByRole("tab");
    await expect(tabs).toHaveCount(6);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await tabs.first().focus();
    await tabs.first().press("End");
    await expect(tabs.last()).toBeFocused();
    await expect(
      page.getByRole("heading", {
        name: "Explain the work, the evidence and the next decision separately.",
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/#method-situation-06$/);
    await expect(
      page.getByRole("link", { name: "See where this fits in your work" }),
    ).toHaveAttribute("href", "/use-cases#practice-next-priorities");
    await openMethod(page, "/framework#method-situation-03");
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  });

  test("supports tabs, isolated plan changes and narrow screens without overflow", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname.startsWith("/api/") &&
        request.method() !== "GET"
      )
        mutations.push(request.url());
    });
    await openMethod(page);
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    const diagnostic = page
      .getByRole("tablist", { name: "Explore a diagnostic question" })
      .getByRole("tab");
    await diagnostic.first().focus();
    await diagnostic.first().press("End");
    await expect(diagnostic.last()).toBeFocused();
    await expect(
      page.getByRole("heading", {
        name: "Are the sources in conflict—or measuring different things?",
      }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Confirmed blocker" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Bring the contact correction forward.",
      }),
    ).toBeVisible();
    await page.getByText("Try adjusting the three-action plan").click();
    const plan = page.getByRole("list", { name: "Demo action plan" });
    await plan
      .getByRole("button", { name: "Move down", exact: true })
      .first()
      .click();
    await expect(plan.locator(":scope > li").first()).toContainText(
      "Verify and align business contact details",
    );
    await page
      .getByRole("button", { name: "Save demo plan", exact: true })
      .click();
    await expect(
      page.getByText("Demo plan saved. It applies only within this demo."),
    ).toBeVisible();
    await page.getByText("Try adjusting the three-action plan").click();
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const scopeTabs = page
        .getByRole("tablist", { name: "Explore the diagnostic scope" })
        .getByRole("tab");
      for (const tab of await scopeTabs.all()) {
        await tab.evaluate((element) =>
          element.scrollIntoView({ block: "center", behavior: "instant" }),
        );
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
      const evidence = page
        .locator("#prospect-diagnosis")
        .getByRole("button", { name: /how this informs the decision/ });
      for (const source of await evidence.all()) {
        await source.click();
        await expect(source).toHaveAttribute("aria-expanded", "true");
        await expect(
          page.locator("#prospect-diagnosis [data-highlight=true]"),
        ).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await source.click();
      }
      for (const label of [
        "Choose a client conversation",
        "Explore the execution brief",
      ]) {
        const tabs = page
          .getByRole("tablist", { name: label })
          .getByRole("tab");
        for (const tab of await tabs.all()) {
          // Resize and variable-height panels can still be scrolling when the
          // pointer action starts. Position the target before the real click.
          await tab.evaluate((element) =>
            element.scrollIntoView({ block: "center", behavior: "instant" }),
          );
          await tab.click();
          await expect(tab).toHaveAttribute("aria-selected", "true");
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
        }
      }
      const report = page.getByRole("region", {
        name: "Complete fictional Verified Action Plan",
      });
      await report.scrollIntoViewIfNeeded();
      await report.focus();
      await report.press("End");
      await expect(
        report.getByText(/End of fictional sample/),
      ).toBeInViewport();
      await report.press("Home");
      await expect(
        report.getByRole("heading", {
          name: "Verified Action Plan",
          exact: true,
        }),
      ).toBeInViewport();
      await expect(
        page.getByRole("img", {
          name: /Editing walkthrough video placeholder/,
        }),
      ).toBeVisible();
      await expect(
        page.locator(
          "#delivery-title video, #delivery-title input, #delivery-title textarea",
        ),
      ).toHaveCount(0);
      await expect(
        page.getByRole("tab", { name: "Client view", exact: true }),
      ).toHaveCount(0);
    }
    expect(mutations).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });
});
