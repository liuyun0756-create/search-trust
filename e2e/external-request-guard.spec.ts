import { expect, test } from "@playwright/test";

import { VERIFIED_DODO_CHECKOUT_URL } from "./fixtures/checkout";
import { LocalApiScenario, installLocalApiRouter } from "./support/api-router";
import { installExternalRequestGuard } from "./support/external-request-guard";

const baseURL = "http://127.0.0.1:3100";

test.describe("offline browser boundary", () => {
  test("allows the application and local checkout fixture on the loopback origin", async ({ context, page }) => {
    await installLocalApiRouter(context, new LocalApiScenario());
    const guard = await installExternalRequestGuard(context, baseURL);

    await page.goto("/cases/new");
    await expect.poll(() => page.evaluate(() => fetch("/api/user/credits").then((response) => response.status)))
      .toBe(200);
    await page.goto(VERIFIED_DODO_CHECKOUT_URL);
    await expect(page.getByRole("heading", { name: "Local Dodo checkout fixture" })).toBeVisible();

    expect(guard.attempts).toEqual([]);
    expect(() => guard.assertClean()).not.toThrow();
  });

  test("aborts and audits external fetch, navigation, beacon, popup, WebSocket, PostHog and Dodo", async ({ context, page }) => {
    await installLocalApiRouter(context, new LocalApiScenario());
    const guard = await installExternalRequestGuard(context, baseURL);
    await page.goto("/cases/new");

    const fetchRejected = await page.evaluate(() =>
      fetch("https://external-fetch.example.invalid/data").then(() => false, () => true));
    expect(fetchRejected).toBe(true);

    const navigationPage = await context.newPage();
    await navigationPage.goto("https://external-navigation.example.invalid/").catch(() => undefined);
    await navigationPage.close();

    await page.evaluate(() => {
      navigator.sendBeacon("https://external-beacon.example.invalid/collect", "synthetic");
    });

    const popupPromise = page.waitForEvent("popup");
    await page.evaluate(() => window.open("https://external-popup.example.invalid/", "_blank"));
    const popup = await popupPromise;
    await popup.waitForLoadState().catch(() => undefined);
    await popup.close();

    const websocketClosed = await page.evaluate(() => new Promise<boolean>((resolve) => {
      const socket = new WebSocket("wss://external-websocket.example.invalid/socket");
      socket.addEventListener("open", () => resolve(false), { once: true });
      socket.addEventListener("close", () => resolve(true), { once: true });
      socket.addEventListener("error", () => resolve(true), { once: true });
      setTimeout(() => resolve(false), 2_000);
    }));
    expect(websocketClosed).toBe(true);

    await page.evaluate(() => fetch("https://us.i.posthog.com/e/", { method: "POST" }).catch(() => undefined));
    await page.goto("https://checkout.dodopayments.com/session/searchtrust-e2e").catch(() => undefined);

    expect(guard.attempts.map((attempt) => attempt.url)).toEqual(expect.arrayContaining([
      "https://external-fetch.example.invalid/data",
      "https://external-navigation.example.invalid/",
      "https://external-beacon.example.invalid/collect",
      "https://external-popup.example.invalid/",
      "wss://external-websocket.example.invalid/socket",
      "https://us.i.posthog.com/e/",
      "https://checkout.dodopayments.com/session/searchtrust-e2e",
    ]));
    expect(() => guard.assertClean()).toThrow(/forbidden external HTTP\/WebSocket/);
  });
});
