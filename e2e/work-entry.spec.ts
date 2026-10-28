import type { Locator } from "@playwright/test";
import { E2E_IDS } from "./fixtures/ids";
import { sampleReports } from "../src/components/sampleReport/sample-report-data";
import { expect, test } from "./support/journey-test";

// Compare document coordinates so smooth anchor movement between reads cannot
// masquerade as overlapping content. Viewport/pinned checks below retain boundingBox.
async function documentBox(locator: Locator) {
  return locator.evaluate((element) => {
    if (!element.getClientRects().length) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
  });
}

test.describe("homepage work entry", () => {
  test("places the introduction above two desktop paths and stacks them on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#choose-work");

    const heading = await documentBox(page.getByRole("heading", { name: "Choose your next move." }));
    const prospect = await documentBox(page.getByRole("link", { name: "Start a Prospect Case" }));
    const service = await documentBox(page.getByRole("link", { name: "Choose a client Case" }));
    if (!heading || !prospect || !service) throw new Error("Work-entry layout is not visible");

    expect(heading.y + heading.height).toBeLessThan(prospect.y);
    expect(heading.y + heading.height).toBeLessThan(service.y);
    expect(prospect.x + prospect.width).toBeLessThanOrEqual(service.x);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileProspect = await documentBox(page.getByRole("link", { name: "Start a Prospect Case" }));
    const mobileService = await documentBox(page.getByRole("link", { name: "Choose a client Case" }));
    if (!mobileProspect || !mobileService) throw new Error("Mobile work-entry paths are not visible");

    expect(mobileProspect.y + mobileProspect.height).toBeLessThan(mobileService.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("separates Prospect intake from existing-client service", async ({ page }) => {
    // Compile the authenticated server page before the SPA click: cold dev-route
    // compilation can trigger Fast Refresh while the navigation is in flight.
    expect((await page.request.get("/cases/service")).ok()).toBe(true);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Choose your next move." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start a Prospect Case" })).toHaveAttribute("href", "/cases/new");

    await page.getByRole("link", { name: "Choose a client Case" }).click();
    await expect(page).toHaveURL(/\/cases\/service$/);
    await expect(page.getByRole("heading", { name: "Cases ready for service" })).toBeVisible();
    await expect(page.getByText("SearchTrust E2E Plumbing")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Already serving this client/ })).toBeVisible();

    await page.getByRole("link", { name: "Continue service" }).click();
    await expect(page).toHaveURL(new RegExp(`/cases/${E2E_IDS.caseId}/connections$`));
    await expect(page.getByRole("heading", { name: "Turn the first diagnosis into a verified plan." })).toBeVisible();
  });

  test("switches the full client conversation by stage, including keyboard and mobile use", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#why-it-changes-work");
    const section = page.locator("#why-it-changes-work");
    const tabs = section.getByRole("tab");
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(section.getByRole("tabpanel")).toHaveCount(1);
    await expect(section.getByText(/Not real client testimonials or results/)).toBeVisible();
    await expect(section.getByRole("heading", { name: "Turn your research into a client decision." })).toBeVisible();
    await expect(section.getByRole("tabpanel").getByText("Which service matters, and what should we tackle first?")).toBeVisible();
    await expect(section.getByRole("tabpanel").getByText("A first scope to discuss")).toBeVisible();
    const start = await documentBox(section.getByRole("tabpanel").getByRole("heading", { name: "You have findings. Which belong in the first proposal?" }));
    const brief = await documentBox(section.getByRole("article"));
    const outcome = await documentBox(section.getByRole("heading", { name: "A first discussion scope" }));
    if (!start || !brief || !outcome) throw new Error("Conversation canvas is not visible");
    expect(start.x + start.width).toBeLessThan(brief.x);
    expect(brief.x + brief.width).toBeLessThan(outcome.x);
    await tabs.nth(1).click();
    await expect(section.locator("#conversation-panel-prospect")).toBeHidden();
    await expect(section.getByRole("tabpanel").getByText("What should we keep, revise or defer?")).toBeVisible();
    await expect(section.getByRole("tabpanel").getByText("Proposed work & review")).toBeVisible();
    await expect(section.getByRole("tabpanel").getByText("A supported next priority")).toBeVisible();
    await expect(section.getByRole("heading", { name: "You have performance data. Which recommendation should change?" })).toBeVisible();
    await expect(section.getByRole("article").getByText(/enquiry causes remain unproven/)).toBeVisible();
    await tabs.nth(1).press("Home");
    await expect(tabs.nth(0)).toBeFocused();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await tabs.nth(0).press("End");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await tabs.nth(1).press("ArrowRight");
    await expect(tabs.nth(0)).toBeFocused();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await page.setViewportSize({ width: 390, height: 844 });
    for (const tab of await tabs.all()) {
      await tab.click();
      await expect(section.getByRole("tabpanel")).toHaveCount(1);
      await expect(section.getByRole("tabpanel").getByText("For SEO review · not a completed task")).toBeVisible();
      const mobileStart = await documentBox(section.getByRole("tabpanel").locator("h3").first());
      const mobileBrief = await documentBox(section.getByRole("article"));
      const mobileOutcome = await documentBox(section.getByRole("tabpanel").locator("h4").first());
      if (!mobileStart || !mobileBrief || !mobileOutcome) throw new Error("Mobile canvas is not visible");
      expect(mobileStart.y + mobileStart.height).toBeLessThan(mobileBrief.y);
      expect(mobileBrief.y + mobileBrief.height).toBeLessThan(mobileOutcome.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    }
    await expect(page).toHaveURL(/\/#why-it-changes-work$/);
  });

  test("distinguishes product work from SEO decisions in a responsive, read-only workbench", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/") && request.method() !== "GET") writes.push(request.url());
    });
    await page.goto("/#what-searchtrust-does");
    const workbench = page.locator("#what-searchtrust-does");
    await expect(workbench.getByRole("heading", { name: "A reviewable plan. Not another pile of inputs." })).toBeVisible();
    await expect(workbench.getByRole("listitem")).toHaveCount(4);
    await expect(workbench.getByText("Edit the plan, not the source observations.")).toBeVisible();
    await expect(workbench.getByText("A changed scope needs its own supporting evidence.", { exact: false })).toBeVisible();
    await expect(workbench.getByRole("button")).toHaveCount(0);
    await expect(workbench.getByRole("tab")).toHaveCount(0);

    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const row of await workbench.getByRole("listitem").all()) {
        await expect(row.locator("dt")).toHaveText(["SearchTrust prepares", "You decide"]);
        // Read one layout frame: anchor smooth-scrolling can otherwise move
        // the page between separate protocol calls for the two columns.
        const [title, product, professional] = await row.evaluate((element) =>
          [element.querySelector("h3"), ...element.querySelectorAll("dd")].map((cell) => {
            if (!cell) return null;
            const { x, y, width, height } = cell.getBoundingClientRect();
            return { x, y, width, height };
          }),
        );
        if (!title || !product || !professional) throw new Error("Responsibilities are not visible");
        if (width === 390) {
          expect(title.y + title.height).toBeLessThan(product.y);
          expect(product.y + product.height).toBeLessThan(professional.y);
        } else {
          expect(title.x + title.width).toBeLessThan(product.x);
          expect(product.x + product.width).toBeLessThan(professional.x);
          expect(Math.abs(product.y - professional.y)).toBeLessThan(2);
        }
      }
      const order = await page.locator("#why-it-changes-work, #what-searchtrust-does, #how-judgment-works").evaluateAll((sections) => sections.map((section) => ({ id: section.id, y: section.getBoundingClientRect().y })));
      expect(order.map((section) => section.id)).toEqual(["why-it-changes-work", "what-searchtrust-does", "how-judgment-works"]);
      expect(order[0].y).toBeLessThan(order[1].y);
      expect(order[1].y).toBeLessThan(order[2].y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    expect(writes).toEqual([]);
  });

  test("explains product limits in the same FAQ content used by structured data", async ({ page }) => {
    await page.goto("/");
    const faq = page.locator("section").filter({ has: page.getByRole("heading", { name: "Straight answers before you spend a credit" }) });
    const structuredFAQ = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) => scripts
      .flatMap((script) => JSON.parse(script.textContent ?? "[]"))
      .find((item) => item["@type"] === "FAQPage").mainEntity as { name: string; acceptedAnswer: { text: string } }[]);
    expect(structuredFAQ).toHaveLength(8);
    await expect(faq.getByRole("button")).toHaveText(structuredFAQ.map((item) => item.name));
    for (const item of structuredFAQ) {
      await faq.getByRole("button", { name: item.name, exact: true }).click();
      await expect(faq.getByRole("button", { name: item.name, exact: true })).toHaveAttribute("aria-expanded", "true");
      await expect(faq.getByText(item.acceptedAnswer.text, { exact: true })).toBeVisible();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await faq.getByRole("button", { name: "Can I edit the report before sharing it?" }).click();
    const answer = faq.getByText(/In the real workspace, you can reorder/);
    await expect(answer).toContainText("not a free-form editor for the entire report");
    await expect(answer).toContainText("Original observations stay unchanged");
    // Do not let an expanded long answer be clipped on phones.
    await expect.poll(() => answer.locator("../..").evaluate((container) => container.scrollHeight - container.clientHeight)).toBeLessThanOrEqual(1);
  });

  test("ends with a concrete first-case guide and preserves both workflow destinations", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/") && request.method() !== "GET") writes.push(request.url());
    });
    await page.goto("/#try-your-first-case");
    const guide = page.locator("#try-your-first-case");
    await expect(guide.getByRole("heading", { name: "Try it on a business you already understand." })).toBeVisible();
    await expect(guide.getByRole("listitem")).toHaveCount(3);
    await expect(guide.getByText(/does not require client analytics access/)).toBeVisible();
    await expect(guide.getByText(/Starting competitor discovery and the full Prospect analysis uses 1 credit/)).toBeVisible();
    await expect(guide.getByText("Choosing an entry does not use a credit.")).toBeVisible();
    await expect(guide.getByText(/Service starts from an existing Prospect Case/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Start a Prospect Case", exact: true })).toHaveCount(1);
    await expect(guide.getByRole("link", { name: "Continue with a client Case" })).toHaveAttribute("href", "/cases/service");

    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const positions = await guide.getByRole("listitem").evaluateAll((items) => items.map((item) => ({ x: item.getBoundingClientRect().x, y: item.getBoundingClientRect().y })));
      if (width === 390) {
        expect(positions[0].y).toBeLessThan(positions[1].y);
        expect(positions[1].y).toBeLessThan(positions[2].y);
      } else {
        expect(positions[0].x).toBeLessThan(positions[1].x);
        expect(positions[1].x).toBeLessThan(positions[2].x);
      }
      const faqBox = await page.getByRole("heading", { name: "Straight answers before you spend a credit" }).boundingBox();
      const guideBox = await guide.boundingBox();
      if (!faqBox || !guideBox) throw new Error("FAQ and guide order is not visible");
      expect(faqBox.y + faqBox.height).toBeLessThan(guideBox.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    const primary = guide.getByRole("button", { name: "Start a Prospect Case", exact: true });
    await primary.focus();
    await expect(primary).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(guide.getByRole("link", { name: "Continue with a client Case" })).toBeFocused();
    await primary.click();
    await expect(page).toHaveURL(/\/cases\/new$/);
    expect(writes).toEqual([]);
    await page.goto("/#try-your-first-case");
    await guide.getByRole("link", { name: "Continue with a client Case" }).click();
    await expect(page).toHaveURL(/\/cases\/service$/);
  });

  test("switches between three client questions while showing one decision path", async ({ page }) => {
    await page.goto("/#how-judgment-works");
    const method = page.locator("#how-judgment-works");
    await expect(method.getByRole("heading", { name: "Make a recommendation you can defend to your client." })).toBeVisible();
    await expect(method.getByText("Method illustrations, not real client results.")).toBeVisible();
    await expect(method.getByRole("tablist")).toHaveAttribute("aria-orientation", "vertical");
    const tabs = method.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(method.getByRole("tabpanel")).toHaveCount(1);
    await expect(method.getByRole("tabpanel").getByRole("heading", { name: "A competitor has a service page. Do we need one too?" })).toBeVisible();
    await expect(method.getByRole("tabpanel").getByText("Improve the page already in place.")).toBeVisible();
    await expect(method.getByRole("tabpanel").getByText(/Not proven: page content caused fewer enquiries/)).toBeVisible();
    for (const label of ["BEFORE ACCESS", "AFTER ACCESS", "WORK DECISION"]) {
      await expect(method.getByRole("tabpanel").getByText(label, { exact: true })).toBeVisible();
    }

    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(method.getByRole("tabpanel").getByRole("heading", { name: "A competitor outranks us. Should we copy their page?" })).toBeVisible();
    await expect(method.getByRole("tabpanel").getByText(/Before copying another site's page/)).toBeVisible();
    await expect(method.locator("#reasoning-panel-01")).toBeHidden();

    await tabs.nth(1).press("ArrowDown");
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(2)).toBeFocused();
    await expect(method.getByRole("tabpanel").getByRole("heading", { name: "Enquiries are falling. Is the page the cause?" })).toBeVisible();
    await expect(method.getByRole("tabpanel").getByText(/A phone-link click is not a completed call/)).toBeVisible();
    await expect(method.getByRole("tabpanel").getByText("Client to confirm", { exact: true })).toBeVisible();
    await tabs.nth(2).press("Home");
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(0)).toBeFocused();
    await tabs.nth(0).press("ArrowUp");
    await expect(tabs.nth(2)).toBeFocused();
    await tabs.nth(2).press("Home");
    await expect(method.getByText("SEO REVIEW BEFORE DELIVERY")).toBeVisible();
    await expect(method.getByText(/save a draft and approve it before sharing/)).toBeVisible();
    await expect(method.getByText(/Source observations stay unchanged/)).toBeVisible();
    await expect(method.getByRole("link", { name: "See the complete method and examples" })).toHaveAttribute("href", "/framework");

    await page.setViewportSize({ width: 1440, height: 900 });
    const desktopTabs = await tabs.all();
    const desktopTabPositions = await Promise.all(desktopTabs.map((tab) => tab.boundingBox()));
    if (desktopTabPositions.some((box) => !box)) throw new Error("Desktop question tabs are not visible");
    expect(desktopTabPositions[0]!.y).toBeLessThan(desktopTabPositions[1]!.y);
    expect(desktopTabPositions[1]!.y).toBeLessThan(desktopTabPositions[2]!.y);
    const desktopPanel = await method.getByRole("tabpanel").boundingBox();
    if (!desktopPanel) throw new Error("Decision record is not visible");
    expect(desktopTabPositions[0]!.x + desktopTabPositions[0]!.width).toBeLessThan(desktopPanel.x);
    const desktopCards = await method.getByRole("tabpanel").locator("h4").all();
    const desktopPositions = await Promise.all(desktopCards.map((card) => card.boundingBox()));
    if (desktopPositions.some((box) => !box)) throw new Error("Desktop decision cards are not visible");
    expect(desktopPositions[0]!.y).toBeLessThan(desktopPositions[1]!.y);
    expect(desktopPositions[1]!.y).toBeLessThan(desktopPositions[2]!.y);
    await method.getByRole("tabpanel").locator("h4").last().scrollIntoViewIfNeeded();
    const pinnedTab = await tabs.nth(0).boundingBox();
    if (!pinnedTab) throw new Error("Pinned question navigation is not visible");
    expect(pinnedTab.y).toBeGreaterThanOrEqual(70);
    expect(pinnedTab.y + pinnedTab.height).toBeLessThan(900);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileTabPositions = await Promise.all(desktopTabs.map((tab) => tab.boundingBox()));
    if (mobileTabPositions.some((box) => !box)) throw new Error("Mobile question tabs are not visible");
    expect(mobileTabPositions[0]!.y).toBeLessThan(mobileTabPositions[1]!.y);
    expect(mobileTabPositions[1]!.y).toBeLessThan(mobileTabPositions[2]!.y);
    const mobilePanel = await method.getByRole("tabpanel").boundingBox();
    if (!mobilePanel) throw new Error("Mobile decision record is not visible");
    expect(mobileTabPositions[2]!.y + mobileTabPositions[2]!.height).toBeLessThan(mobilePanel.y);
    const mobilePositions = await Promise.all(desktopCards.map((card) => card.boundingBox()));
    if (mobilePositions.some((box) => !box)) throw new Error("Mobile decision cards are not visible");
    expect(mobilePositions[0]!.y).toBeLessThan(mobilePositions[1]!.y);
    expect(mobilePositions[1]!.y).toBeLessThan(mobilePositions[2]!.y);
    for (const tab of desktopTabs) {
      await tab.click();
      await expect(method.getByRole("tabpanel")).toHaveCount(1);
      await expect(method.getByRole("tabpanel").getByText("Keep in view", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    }
    await expect(page).toHaveURL(/\/#how-judgment-works$/);
  });

  test("switches report documents and opens the matching complete sample without starting a workflow", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/") && request.method() !== "GET") writes.push(request.url());
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/#report-outcome");
    const preview = page.locator("#report-outcome");
    const tabs = preview.getByRole("tab");
    await expect(preview.getByRole("heading", { name: "A proposal to discuss. A work plan to review." })).toBeVisible();
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(preview.getByRole("tabpanel")).toHaveCount(1);

    for (const [index, report] of sampleReports.entries()) {
      await tabs.nth(index).click();
      const panel = preview.getByRole("tabpanel");
      await expect(panel.getByRole("heading", { name: report.name, exact: true })).toBeVisible();
      await expect(panel.getByText("Fictional case · summary preview")).toBeVisible();
      await expect(panel.getByRole("list").last().getByRole("listitem")).toHaveCount(3);
      await expect(panel.getByText(report.limits[1])).toBeVisible();
      await expect(panel.getByText("To confirm", { exact: true })).toBeVisible();
      await expect(panel.getByText("Proposed · not implemented")).toBeVisible();
      await expect(panel.getByRole("link", { name: "Read this complete report" })).toHaveAttribute("href", "/sample-report#sample-" + report.stage);
      const paper = await panel.getByRole("article").boundingBox();
      if (!paper) throw new Error("Report summary is not visible");
      expect(paper.height).toBeLessThan(740);
      const [basis, plan] = await panel.locator("h5").evaluateAll((headings) => headings.map((heading) => {
        const box = heading.getBoundingClientRect();
        return { x: box.x, y: box.y };
      }));
      expect(basis.x).toBeLessThan(plan.x);
      expect(Math.abs(basis.y - plan.y)).toBeLessThan(2);
    }
    await expect(preview.locator("#output-panel-prospect")).toBeHidden();
    await expect(preview.getByRole("tabpanel").getByText("REVISED AFTER CLIENT CONFIRMATION + DATA ACCESS")).toBeVisible();
    await expect(preview.getByRole("tabpanel").getByRole("heading", { name: "Improve the confirmed service page. Don't create a duplicate." })).toBeVisible();
    await tabs.nth(1).press("ArrowRight");
    await expect(tabs.nth(0)).toBeFocused();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await tabs.nth(0).press("End");
    await expect(tabs.nth(1)).toBeFocused();
    await tabs.nth(1).press("Home");
    await expect(tabs.nth(0)).toBeFocused();
    await expect(preview.getByRole("tabpanel").getByRole("heading", { name: "Confirm the existing page before creating a new one." })).toBeVisible();
    await expect(preview.getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "See pricing details" })).toHaveAttribute("href", "/pricing");
    await expect(page.getByRole("link", { name: "Continue with a client Case" })).toHaveAttribute("href", "/cases/service");

    await page.setViewportSize({ width: 390, height: 844 });
    for (const tab of await tabs.all()) {
      await tab.click();
      await expect(preview.getByRole("tabpanel")).toHaveCount(1);
      const [basisY, planY] = await preview.getByRole("tabpanel").locator("h5").evaluateAll((headings) => headings.map((heading) => heading.getBoundingClientRect().y));
      expect(basisY).toBeLessThan(planY);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    }
    expect(writes).toEqual([]);
    await expect(page).toHaveURL(/\/#report-outcome$/);
    await preview.getByRole("link", { name: "Read this complete report" }).click();
    await expect(page).toHaveURL(/\/sample-report#sample-verified$/);
    await expect(page.locator("#sample-verified").getByRole("heading", { name: "Verified Action Plan", exact: true })).toBeInViewport();
    await page.goto("/#report-outcome");
    await page.locator("#report-outcome").getByRole("link", { name: "Read this complete report" }).click();
    await expect(page).toHaveURL(/\/sample-report#sample-prospect$/);
    await expect(page.locator("#sample-prospect").getByRole("heading", { name: "Prospect Evidence Report", exact: true })).toBeInViewport();
  });

  test("does not send Serve a client through Prospect intake", async ({ page }) => {
    await page.goto("/cases/new");
    await page.getByText("Serve a client", { exact: true }).click();
    await expect(page.getByRole("link", { name: "Choose an existing Case" })).toHaveAttribute("href", "/cases/service");
    await expect(page.getByRole("button", { name: /Check this prospect/ })).toHaveCount(0);
  });
});
