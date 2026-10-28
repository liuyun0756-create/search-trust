import { expect, test } from "./support/journey-test";
import {
  practiceGroups,
  practiceScenarios,
  practiceStages,
} from "../src/components/useCase/practice-scenarios";

test.describe("Client Scenarios workbench", () => {
  test("reads all fifteen cards in two uninterrupted stage carousels", async ({
    page,
  }) => {
    await page.goto("/use-cases");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "From the first pitch to the next client review.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Find your situation/ }),
    ).toHaveAttribute("href", "#practice-scenarios");
    await page.getByRole("link", { name: /Find your situation/ }).click();
    await expect(page.getByRole("tablist", { name: "Choose a stage of work" })).toHaveCount(1);
    for (const stage of practiceStages) {
      await page.locator(`#practice-stage-tab-${stage.id}`).click();
      const ids = stage.groupIds.flatMap(
        (groupId) =>
          practiceGroups.find((group) => group.id === groupId)!.scenarioIds,
      );
      await expect(
        page
          .getByRole("region", { name: `${stage.label} situation cards` })
          .locator("article"),
      ).toHaveCount(ids.length);
      for (const [index, id] of ids.entries()) {
        if (index > 0)
          await page
            .getByRole("button", { name: `Next ${stage.label} situation` })
            .click();
        const story = practiceScenarios.find((item) => item.id === id)!;
        const group = practiceGroups.find((item) => item.id === story.groupId)!;
        const card = page.getByTestId(`practice-scene-${id}`);
        await expect(card).toHaveAttribute("aria-hidden", "false");
        await expect(
          card.getByText(story.shortTitle, { exact: true }),
        ).toBeVisible();
        await expect(
          card.getByText(`${group.number} · ${group.tabLabel}`),
        ).toBeVisible();
        await expect(
          card.getByRole("heading", { name: story.title }),
        ).toBeVisible();
        await expect(
          card.getByRole("heading", { level: 4, name: story.artifact.title }),
        ).toBeVisible();
        await expect(card.getByText(story.boundary)).toBeVisible();
        await expect
          .poll(() =>
            card.evaluate((element) => {
              const viewport = element.parentElement?.parentElement;
              return viewport
                ? Math.abs(
                    element.getBoundingClientRect().left -
                      viewport.getBoundingClientRect().left,
                  )
                : Infinity;
            }),
          )
          .toBeLessThan(4);
        await expect(page).toHaveURL(new RegExp(`#practice-${id}$`));
      }
    }
  });

  test("remembers each stage's card and keeps keyboard navigation clear", async ({
    page,
  }) => {
    await page.goto("/use-cases");
    const stageTabs = page
      .getByRole("tablist", { name: "Choose a stage of work" })
      .getByRole("tab");
    await expect(stageTabs).toHaveCount(2);
    await expect(stageTabs.first()).toHaveAttribute("aria-selected", "true");
    const nextFirst = page.getByRole("button", {
      name: "Next Win the work situation",
    });
    await nextFirst.click();
    await expect(nextFirst).toBeFocused();
    await expect(
      page.getByTestId("practice-scene-competitor-question"),
    ).toHaveAttribute("aria-hidden", "false");
    await expect(
      page.getByTestId("practice-scene-first-conversation"),
    ).toHaveAttribute("inert", "");
    await nextFirst.click();
    await nextFirst.click();
    await expect(
      page.getByTestId("practice-scene-limited-budget"),
    ).toHaveAttribute("aria-hidden", "false");

    await stageTabs.first().focus();
    await stageTabs.first().press("ArrowRight");
    await expect(stageTabs.last()).toBeFocused();
    await page
      .getByRole("button", { name: "Next Deliver the work situation" })
      .click();
    await expect(
      page.getByTestId("practice-scene-execution-brief"),
    ).toHaveAttribute("aria-hidden", "false");
    await stageTabs.last().press("ArrowLeft");
    await expect(stageTabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByTestId("practice-scene-limited-budget"),
    ).toHaveAttribute("aria-hidden", "false");
    await stageTabs.first().press("End");
    await expect(
      page.getByTestId("practice-scene-execution-brief"),
    ).toHaveAttribute("aria-hidden", "false");
    await stageTabs.last().press("Home");
    await expect(
      page.getByTestId("practice-scene-limited-budget"),
    ).toHaveAttribute("aria-hidden", "false");
  });

  test("restores new and legacy deep links without losing search parameters", async ({
    page,
  }) => {
    for (const { id } of practiceScenarios) {
      await page.goto(`/use-cases?source=review#practice-${id}`);
      await expect(page.getByTestId(`practice-scene-${id}`)).toHaveAttribute(
        "aria-hidden",
        "false",
      );
      await expect(page.getByTestId(`practice-scene-${id}`)).toBeInViewport();
      await expect(page).toHaveURL(/source=review/);
    }
    for (const [alias, id] of Object.entries({
      "scene-01": "first-conversation",
      "scene-02": "revisit-recommendation",
      "scene-03": "revisit-recommendation",
      "scene-04": "revisit-recommendation",
      "scene-05": "next-priorities",
      "scene-06": "next-priorities",
    })) {
      await page.goto(`/use-cases?legacy=${alias}#${alias}`);
      await expect(
        page.getByTestId(`practice-scene-${id}`),
        alias,
      ).toHaveAttribute("aria-hidden", "false");
    }
    await page.evaluate(() => {
      window.location.hash = "scene-02";
    });
    await expect(
      page.getByTestId("practice-scene-revisit-recommendation"),
    ).toHaveAttribute("aria-hidden", "false");
    await page.goto("/use-cases#practice-unknown-story");
    await expect(
      page.getByTestId("practice-scene-first-conversation"),
    ).toHaveAttribute("aria-hidden", "false");
  });

  test("native horizontal movement updates the selected story", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/use-cases");
    await page.locator("#practice-scenarios").scrollIntoViewIfNeeded();
    const viewport = page.getByRole("region", {
      name: "Win the work situation cards",
    });
    await viewport.evaluate((element) => {
      element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      const next = element.querySelectorAll("article")[1] as HTMLElement;
      element.scrollLeft = next.offsetLeft;
    });
    await expect(
      page.getByTestId("practice-scene-competitor-question"),
    ).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#practice-stage-panel-prospect")).toContainText(
      "02 / 06",
    );
    await expect(page).toHaveURL(/#practice-competitor-question$/);
  });

  test("sample and method links resolve to existing reading targets", async ({
    page,
  }) => {
    const hrefs = new Set(
      practiceScenarios.flatMap((story) => [
        story.sampleLink.href,
        ...(story.methodLink
          ? [`/framework#method-situation-${story.methodLink}`]
          : []),
      ]),
    );
    for (const href of hrefs) {
      await page.goto(href);
      const id = href.split("#")[1];
      await expect(page.locator(`[id="${id}"]`).first()).toBeAttached();
    }
  });

  test("a touch swipe changes cards without blocking page scrolling", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/use-cases");
    const viewport = page.getByRole("region", {
      name: "Win the work situation cards",
    });
    await viewport.scrollIntoViewIfNeeded();
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    const y = Math.max(150, Math.min(box.y + 160, 700));
    const startX = Math.min(box.x + box.width - 25, 365);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: startX, y }],
    });
    for (const distance of [60, 130, 210, 290]) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: startX - distance, y }],
      });
      await page.waitForTimeout(35);
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(
      page.getByTestId("practice-scene-competitor-question"),
    ).toHaveAttribute("aria-hidden", "false");
    const beforeY = await page.evaluate(() => window.scrollY);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 190, y: 650 }],
    });
    for (const yMove of [590, 510, 430, 350]) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 190, y: yMove }],
      });
      await page.waitForTimeout(35);
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(beforeY);
    await client.detach();
  });

  test("has no page overflow or business mutation across five widths", async ({
    page,
  }) => {
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname.startsWith("/api/") &&
        request.method() !== "GET"
      )
        mutations.push(request.url());
    });
    await page.goto("/use-cases#practice-quarterly-next-phase");
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(
        page.getByTestId("practice-scene-quarterly-next-phase"),
      ).toHaveAttribute("aria-hidden", "false");
      await expect
        .poll(() =>
          page
            .getByTestId("practice-scene-quarterly-next-phase")
            .evaluate((element) => {
              const viewport = element.parentElement?.parentElement;
              return viewport
                ? Math.abs(
                    element.getBoundingClientRect().left -
                      viewport.getBoundingClientRect().left,
                  )
                : Infinity;
            }),
        )
        .toBeLessThan(4);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    expect(mutations).toEqual([]);
  });
});
