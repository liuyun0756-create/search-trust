import { expect, test } from "./support/journey-test";

test.describe("sample deliverable page", () => {
  test("shows report evidence inside independent client conversations", async ({
    page,
  }) => {
    await page.goto("/sample-report#report-conversations");
    const section = page.locator("#report-conversations");
    await expect(section.getByRole("article")).toHaveCount(3);
    await expect(section.locator("input, textarea, form")).toHaveCount(0);
    for (const card of await section.getByRole("article").all()) {
      await expect(card.getByRole("region")).toBeVisible();
      await expect(card.locator("dd")).toHaveCount(3);
      await expect(card.getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    }
    const buttons = section.getByRole("button");
    await buttons.nth(0).focus();
    await buttons.nth(0).press("Enter");
    await expect(buttons.nth(0)).toBeFocused();
    await buttons.nth(1).click();
    await expect(buttons.nth(0)).toHaveAttribute("aria-expanded", "true");
    await expect(buttons.nth(1)).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#reply-reasoning")).toBeVisible();
    await expect(page.locator("#reply-scope")).toBeVisible();
    await buttons.nth(0).click();
    await expect(page.locator("#reply-reasoning")).toBeHidden();
    await expect(page.locator("#reply-scope")).toBeVisible();
    for (const width of [1440, 1191, 1024, 390]) {
      await page.setViewportSize({ width, height: 953 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      const boxes = await section.getByRole("article").evaluateAll((cards) =>
        cards.map((card) => {
          const box = card.getBoundingClientRect();
          return { x: box.x, y: box.y, bottom: box.bottom };
        }),
      );
      if (width >= 1024) expect(boxes[0].y).toBe(boxes[1].y);
      else expect(boxes[1].y).toBeGreaterThan(boxes[0].bottom);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page
        .locator("#reply-scope")
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("none");
    await expect(page).toHaveURL(/#report-conversations$/);
    await expect(
      page.getByRole("tab", { name: /Prospect Evidence Report/ }),
    ).toHaveAttribute("aria-selected", "true");
  });
  test("demonstrates delivery without forms, mutations or changes to the report", async ({
    page,
  }) => {
    const mutations: string[] = [];
    const errors: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname.startsWith("/api/") &&
        request.method() !== "GET"
      )
        mutations.push(request.url());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/sample-report#plan-review");
    const showcase = page.locator("#plan-review");
    await expect(
      showcase.locator("input, textarea, form, [contenteditable]"),
    ).toHaveCount(0);
    await expect(
      showcase.getByRole("tab", { name: /Adapt the plan/ }),
    ).toHaveAttribute("aria-selected", "true");
    await showcase
      .getByRole("button", { name: "Proposed plan", exact: true })
      .click();
    await expect(showcase.getByRole("article")).toContainText(
      "Clarify the existing repair-service page.",
    );
    await showcase
      .getByRole("button", { name: "SEO adaptation", exact: true })
      .click();
    await expect(showcase.getByRole("article")).toContainText(
      "Start with client-approved service coverage",
    );
    for (const width of [1440, 1191, 1024, 390]) {
      await page.setViewportSize({ width, height: 953 });
      for (const label of [
        /Adapt the plan/,
        /Review delivery/,
        /Add your identity/,
      ]) {
        await showcase.getByRole("tab", { name: label }).click();
        await expect(showcase.getByRole("tabpanel")).toHaveCount(1);
        await expect(showcase.getByRole("article")).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
    }
    await showcase
      .getByRole("button", { name: "Default cover", exact: true })
      .click();
    await expect(showcase.getByRole("article")).not.toContainText("Northline");
    await showcase
      .getByRole("button", { name: "With your identity", exact: true })
      .click();
    await expect(showcase.getByRole("article")).toContainText("Northline");
    await expect(showcase.getByRole("article")).toContainText("SearchTrust");
    await expect(showcase).toContainText(
      "is not saved and does not apply to online share links",
    );
    await showcase
      .getByRole("tab", { name: /Add your identity/ })
      .press("Home");
    await expect(
      showcase.getByRole("tab", { name: /Adapt the plan/ }),
    ).toBeFocused();
    await showcase
      .getByRole("tab", { name: /Adapt the plan/ })
      .press("ArrowRight");
    await expect(
      showcase.getByRole("tab", { name: /Review delivery/ }),
    ).toBeFocused();
    await expect(
      showcase.getByRole("article").getByRole("listitem"),
    ).toHaveCount(3);
    await expect(showcase).toContainText(
      "They do not prove that its content caused fewer enquiries",
    );
    await expect(showcase).toContainText(
      "Later edits do not update PDFs already downloaded",
    );
    await expect(
      showcase.getByRole("link", {
        name: "Start a Prospect Case",
        exact: true,
      }),
    ).toHaveAttribute("href", "/cases/new");
    await expect(
      showcase.getByRole("link", {
        name: "Continue with a client Case",
        exact: true,
      }),
    ).toHaveAttribute("href", "/cases/service");
    await expect(
      page.getByRole("tab", { name: /Prospect Evidence Report/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(mutations).toEqual([]);
    expect(errors).toEqual([]);
  });
  test("reads chapters, follows continuous scrolling and restores deep links on desktop and mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 953 });
    await page.goto("/sample-report#sample-prospect");
    const report = page.getByRole("article", {
      name: "Prospect Evidence Report document",
    });
    const nav = page.getByRole("navigation", {
      name: "Prospect Evidence Report chapters",
    });
    await expect(report.getByRole("region")).toHaveCount(1);
    await expect(nav.getByRole("link", { name: /Summary/ })).toHaveAttribute(
      "aria-current",
      "location",
    );
    await nav.getByRole("link", { name: /Proposed actions/ }).focus();
    await nav.getByRole("link", { name: /Proposed actions/ }).press("Enter");
    await expect(page).toHaveURL(/#sample-prospect-actions$/);
    await expect(page.locator("#sample-prospect-actions")).toBeFocused();
    await expect(report.getByRole("heading", { level: 5 })).toHaveCount(3);
    await expect(
      report.getByText("Completion standard", { exact: true }),
    ).toHaveCount(3);
    await report.getByRole("button", { name: "Next: Client input" }).click();
    await expect(
      report.getByRole("region", { name: "Client input" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      nav.getByRole("link", { name: /Client input/ }),
    ).toHaveAttribute("aria-current", "location");
    await page.getByRole("button", { name: "Continuous", exact: true }).click();
    await expect(report.getByRole("region")).toHaveCount(5);
    // Scroll independently of the chapter links, so this verifies scroll tracking.
    await page
      .locator("#sample-prospect-actions")
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    await expect(
      nav.getByRole("link", { name: /Proposed actions/ }),
    ).toHaveAttribute("aria-current", "location");
    const sticky = await nav.boundingBox();
    expect(sticky!.y).toBeGreaterThanOrEqual(100);
    expect(sticky!.y).toBeLessThan(130);
    await page.getByRole("button", { name: "By chapter", exact: true }).click();
    await expect(report.getByRole("region")).toHaveCount(1);
    for (const width of [1191, 1024, 390]) {
      await page.setViewportSize({ width, height: 953 });
      if (width < 760) {
        await page
          .getByRole("combobox", { name: "Choose a report chapter" })
          .selectOption("review");
      } else {
        await nav.getByRole("link", { name: /Review & limits/ }).click();
      }
      await expect(
        report.getByRole("region", { name: "Review & limits" }),
      ).toBeInViewport();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await page.goto("/sample-report#sample-verified-actions");
    await expect(
      page.getByRole("combobox", { name: "Choose a report chapter" }),
    ).toHaveValue("actions");
    await expect(
      page
        .locator("#sample-verified-actions")
        .getByRole("heading", { level: 5 }),
    ).toHaveCount(3);
    await expect(
      page.getByRole("link", { name: "Review & branding", exact: true }),
    ).toHaveCount(1);
  });
  test("shows complete workflows behind left-aligned stage tabs without changing the report", async ({
    page,
  }) => {
    await page.goto("/sample-report#report-workflow");
    const guide = page.getByRole("region", { name: "Client report workflow" });
    const tabs = guide.getByRole("tablist");
    const first = guide.getByRole("tab", {
      name: "01 Win the work",
      exact: true,
    });
    await expect(first).toHaveAttribute("aria-selected", "true");
    for (const width of [1440, 1191, 1024, 390]) {
      await page.setViewportSize({ width, height: 953 });
      const groupBox = await guide.boundingBox();
      const tabBox = await tabs.boundingBox();
      expect(Math.abs(groupBox!.x - tabBox!.x)).toBeLessThan(2);
      for (const name of ["01 Win the work", "02 Deliver the work"]) {
        await guide.getByRole("tab", { name, exact: true }).click();
        const panel = guide.getByRole("tabpanel");
        await expect(panel.getByRole("heading", { level: 4 })).toHaveCount(6);
        for (const heading of await panel
          .getByRole("heading", { level: 4 })
          .all())
          await expect(heading).toBeVisible();
        await expect(panel.locator("details")).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
    }
    const hash = new URL(page.url()).hash;
    await first.focus();
    await first.press("End");
    await expect(
      guide.getByRole("tab", { name: "02 Deliver the work", exact: true }),
    ).toBeFocused();
    expect(new URL(page.url()).hash).toBe(hash);
    await expect(
      page.getByRole("tab", { name: /Prospect Evidence Report/ }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByText(
        /Service analysis currently requires a completed Prospect Case/,
      ),
    ).toBeVisible();
  });
  test("centers the hero entries and opens either report without duplicate workflow buttons", async ({
    page,
  }) => {
    await page.goto("/sample-report");
    const entries = page.getByRole("group", { name: "Read a report" });
    await expect(entries.getByRole("button")).toHaveCount(2);
    for (const width of [1440, 1191, 1024, 390]) {
      await page.setViewportSize({ width, height: 953 });
      const title = await page.getByRole("heading", { level: 1 }).boundingBox();
      const buttons = await entries.boundingBox();
      expect(title).not.toBeNull();
      expect(buttons).not.toBeNull();
      expect(Math.abs(title!.x + title!.width / 2 - width / 2)).toBeLessThan(2);
      expect(buttons!.y).toBeGreaterThan(title!.y + title!.height);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await expect(
      page
        .getByRole("region", { name: "Client report workflow", exact: true })
        .getByRole("button", { name: /^Read the/ }),
    ).toHaveCount(0);
    for (const [name, id, title] of [
      ["Read the Verified plan", "sample-verified", "Verified Action Plan"],
      [
        "Read the Prospect report",
        "sample-prospect",
        "Prospect Evidence Report",
      ],
    ]) {
      const button = entries.getByRole("button", { name, exact: true });
      await button.focus();
      await expect(button).toBeFocused();
      await button.press("Enter");
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(
        page.getByRole("tabpanel", {
          name: /Prospect Evidence Report|Verified Action Plan/,
        }),
      ).toHaveAttribute("id", id);
      await expect(
        page
          .locator(`#${id}`)
          .getByRole("heading", { name: title, exact: true }),
      ).toBeInViewport();
    }
  });
  test("keeps deep links, workflows and report chapters connected", async ({
    page,
  }) => {
    await page.goto("/sample-report#sample-verified");
    await expect(
      page.getByRole("tab", { name: /Verified Action Plan/ }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page
        .locator("#sample-verified")
        .getByRole("heading", { name: "Verified Action Plan", exact: true }),
    ).toBeInViewport();
    await page.getByRole("tab", { name: /Verified Action Plan/ }).press("Home");
    await expect(
      page.getByRole("tabpanel", {
        name: /Prospect Evidence Report|Verified Action Plan/,
      }),
    ).toHaveAttribute("id", "sample-prospect");
    await page
      .getByRole("navigation", { name: "Prospect Evidence Report chapters" })
      .getByRole("link", { name: /Evidence & open questions/ })
      .click();
    await expect(page).toHaveURL(/#sample-prospect-evidence$/);
    await page
      .getByRole("tabpanel", {
        name: /Prospect Evidence Report|Verified Action Plan/,
      })
      .getByText("Inspect the basis", { exact: true })
      .first()
      .click();
    await expect(
      page.getByText(
        "Whether another service page exists, which URL the business uses and whether a replacement is planned.",
      ),
    ).toBeVisible();
    await page
      .getByRole("tab", { name: "02 Deliver the work", exact: true })
      .click();
    await expect(
      page.getByText(/Choose the client’s completed Prospect Case/),
    ).toBeVisible();
    await page.getByRole("tab", { name: /Verified Action Plan/ }).click();
    await page
      .getByRole("navigation", { name: "Verified Action Plan chapters" })
      .getByRole("link", { name: /Proposed actions/ })
      .click();
    await expect(page).toHaveURL(/#sample-verified-actions$/);
    await expect(
      page.getByRole("tabpanel", {
        name: /Prospect Evidence Report|Verified Action Plan/,
      }),
    ).toHaveAttribute("id", "sample-verified");
    await expect(
      page
        .locator("#sample-verified-actions")
        .getByRole("heading", { name: "Three actions to review first." }),
    ).toBeInViewport();
    await expect(
      page
        .getByRole("link", { name: "Start a Prospect Case", exact: true })
        .first(),
    ).toHaveAttribute("href", "/cases/new");
    await expect(
      page.getByRole("link", { name: "Continue with a client Case" }).first(),
    ).toHaveAttribute("href", "/cases/service");
    await expect(
      page.getByRole("link", { name: "Pricing and credit details" }),
    ).toHaveAttribute("href", "/pricing");
    const pdf = await page.request.get(
      "/samples/searchtrust-client-delivery-example.pdf",
    );
    expect(pdf.ok()).toBeTruthy();
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
  });

  test("keeps both stages and delivery showcase readable at desktop and mobile widths", async ({
    page,
  }) => {
    await page.goto("/sample-report");
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const name of [/Prospect Evidence Report/, /Verified Action Plan/]) {
        await page.getByRole("tab", { name }).click();
        await expect(
          page.getByRole("tabpanel", {
            name: /Prospect Evidence Report|Verified Action Plan/,
          }),
        ).toHaveCount(1);
        await page
          .getByRole("button", { name: "Continuous", exact: true })
          .click();
        await expect(
          page.locator(
            '[role="tabpanel"]:visible article section:not([hidden])',
          ),
        ).toHaveCount(5);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
      await page.getByRole("link", { name: "Review & branding" }).click();
      await expect(
        page
          .locator("#plan-review")
          .getByRole("tablist", { name: "Explore client delivery" }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
  });
});
