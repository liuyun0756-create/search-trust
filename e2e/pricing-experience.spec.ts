import { mkdir } from "node:fs/promises";
import { expect, test } from "./support/journey-test";

const shots = "output/playwright/pricing-review";
test.beforeAll(async () => { await mkdir(shots, { recursive: true }); });
test.use({ scenarioOptions: { verifiedBalance: 5 } });

test("guest identity entry, report content, responsive layout and keyboard FAQ", async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem("searchtrust:e2e:auth", "guest"));
  const writes: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/") && request.method() === "POST") writes.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Start with 5 free credits.Buy more when you need them.");
  await expect(page.getByText("$19", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${shots}/pricing-desktop-guest.png` });
  await page.screenshot({ path: `${shots}/pricing-full-page.png`, fullPage: true });
  const free = page.getByRole("button", { name: "Get my 5 free credits" }).first();
  await free.click();
  await expect(page.getByRole("dialog", { name: "Local test sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(free).toBeFocused();
  expect(writes).toEqual([]);
  await expect(page).toHaveURL(/\/pricing$/);
  for (const width of [320, 390, 768, 1024, 1440, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 720 : 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const currency = page.getByText("USD / credit", { exact: true });
    await expect(currency).toBeVisible();
    if (width === 390 || width === 1280) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${shots}/pricing-guest-${width}.png` }); }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#pricing-deliverables").evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "instant" }));
  await page.screenshot({ path: `${shots}/pricing-mobile-deliverables.png` });
  const faq = page.getByRole("button", { name: "When is a credit used?" });
  await faq.focus(); await faq.press("Enter");
  await expect(faq).toHaveAttribute("aria-expanded", "true");
  const answer = page.getByRole("region", { name: "When is a credit used?" });
  await expect(answer).toContainText("Correcting a competitor");
  expect(await answer.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  await faq.press("Enter"); await expect(answer).toBeHidden();
  await expect(page.getByRole("link", { name: "Read the sample report", exact: true })).toHaveAttribute("href", "/sample-report#sample-prospect");
  await expect(page.getByRole("link", { name: "Read the sample plan", exact: true })).toHaveAttribute("href", "/sample-report#sample-verified");
  // A 1280×900 viewport at 200% browser zoom has a 640×450 CSS-pixel layout.
  // CSS zoom is not equivalent: it does not update media-query breakpoints.
  await page.setViewportSize({ width: 640, height: 450 });
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(640);
  await page.screenshot({ path: `${shots}/pricing-200-percent.png` });
  expect(writes).toEqual([]);
});

test("sign in after purchase click requires another explicit purchase and exposes shared balance", async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem("searchtrust:e2e:auth", "guest"));
  let purchases = 0;
  await page.route("**/api/v2/credits/checkout", async route => { purchases++; await route.fulfill({ status: 500, json: { error: { message: "private-provider-detail" } } }); });
  await page.goto("/pricing");
  await page.getByRole("button", { name: "Buy 1 credit · $19", exact: true }).click();
  await page.getByRole("button", { name: "Continue with test account" }).click();
  await expect(page.getByText("5 credits in your account", { exact: true })).toBeVisible();
  expect(purchases).toBe(0);
  await page.getByRole("button", { name: "Buy 1 credit · $19", exact: true }).first().click();
  await expect(page.getByRole("alert").first()).toHaveText("Checkout could not be opened. Please try again.");
  expect(purchases).toBe(1);
  await expect(page.getByText("private-provider-detail")).toHaveCount(0);
});

test("account balance states and report-page hero comparisons", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const state of [5, 1, 0, "error", "loading"] as const) {
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/user/credits", async route => {
      if (state === "loading") await gate;
      await route.fulfill({ status: state === "error" ? 503 : 200, json: state === "error" ? {} : { credits: state === "loading" ? 5 : state } }).catch(() => {});
    });
    await page.goto("/pricing");
    if (state === "loading") await expect(page.getByText("Loading your balance…")).toBeVisible();
    else if (state === "error") await expect(page.getByText("Balance unavailable")).toBeVisible();
    else await expect(page.getByText(`${state} ${state === 1 ? "credit" : "credits"} in your account`, { exact: true })).toBeVisible();
    await page.screenshot({ path: `${shots}/pricing-balance-${state}.png` });
    release!();
    await page.unroute("**/api/user/credits");
  }
  for (const path of ["sample-report", "use-cases"]) {
    await page.goto(`/${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.screenshot({ path: `${shots}/${path}-desktop.png` });
  }
});

test("pending payment retries same order and updates balance without a purchase", async ({ page }) => {
  let confirmed = false;
  const ids: string[] = [];
  let purchases = 0;
  await page.route("**/api/user/credits", route => route.fulfill({ json: { credits: confirmed ? 6 : 5 } }));
  await page.route("**/api/v2/credits/checkout", async route => { purchases++; await route.abort(); });
  await page.route("**/api/v2/credits/checkout/confirm", async route => {
    ids.push(route.request().postDataJSON().payment_id);
    confirmed = ids.length > 1;
    await route.fulfill(confirmed ? { json: { ok: true, credits_added: 1, credit_balance: 6, already_confirmed: true } } : { status: 409, json: { error: { code: "PAYMENT_NOT_COMPLETED", message: "Payment is processing." } } });
  });
  await page.goto("/pricing?campaign=local&payment=return&payment_id=local-test-payment#pricing-title");
  await expect(page.getByText(/Please do not pay again/)).toBeVisible();
  await page.evaluate(() => { window.scrollTo(0, 0); window.history.replaceState({ ...window.history.state, retained: true }, "", window.location.href); });
  await page.screenshot({ path: `${shots}/pricing-payment-pending.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${shots}/pricing-mobile-payment-pending.png` });
  await page.getByRole("button", { name: "Check payment status" }).click();
  await expect(page.getByText("Purchase confirmed. Your balance is 6 credits.")).toBeVisible();
  await expect(page.getByText("6 credits in your account", { exact: true })).toBeVisible();
  expect(ids).toEqual(["local-test-payment", "local-test-payment"]);
  expect(purchases).toBe(0);
  await expect(page).toHaveURL(/\/pricing\?campaign=local#pricing-title$/);
  expect(await page.evaluate(() => window.history.state.retained)).toBe(true);
  await page.screenshot({ path: `${shots}/pricing-payment-success.png` });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: `${shots}/pricing-payment-success-desktop.png` });
});

test("unknown, cancelled and missing-ID payment returns remain recoverable", async ({ page }) => {
  await page.route("**/api/v2/credits/checkout/confirm", route => route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR", message: "internal-secret" } } }));
  for (const state of ["unknown", "cancelled", "missing"]) {
    await page.goto(`/pricing?payment=${state === "cancelled" ? "cancelled" : "return"}${state === "unknown" ? "&payment_id=local-test-payment" : ""}`);
    await expect(page.getByRole("link", { name: "Contact payment support" })).toBeVisible();
    if (state === "unknown") await expect(page.getByRole("button", { name: "Check payment status" })).toBeVisible();
    if (state === "missing") await expect(page.getByText("We couldn’t identify this payment return.")).toBeVisible();
    await expect(page.getByText(/No credit was added|internal-secret|Purchase confirmed/)).toHaveCount(0);
    await page.screenshot({ path: `${shots}/pricing-payment-${state}.png` });
  }
});
