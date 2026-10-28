import { E2E_IDS } from "./fixtures/ids";
import { E2E_SHARE_TOKEN } from "./fixtures/share";
import { expect, test } from "./support/journey-test";

test("creates, resolves and revokes a fragment-only client share without analytics", async ({ page }) => {
  const requestUrls: string[] = [];
  page.on("request", (request) => requestUrls.push(request.url()));

  const reportUrl = `/cases/${E2E_IDS.caseId}/reports/${E2E_IDS.reportId}`;
  // Compile the authenticated route before interacting with it. The toolbar
  // also stays disabled until hydration, so its first click cannot be lost.
  expect((await page.request.get(reportUrl)).ok()).toBe(true);
  await page.goto(reportUrl);
  await expect(page.getByText("Review before delivery")).toBeVisible();
  await expect(page.getByText("Version 1 is private.")).toHaveCount(0);
  await page.getByRole("button", { name: "Share" }).click();
  await page.getByRole("button", { name: "Create secure link" }).click();
  const shareUrl = await page.getByText(new RegExp(`/share#${E2E_SHARE_TOKEN}`)).textContent();
  expect(shareUrl).toBeTruthy();
  expect(new URL(shareUrl!).search).toBe("");

  await page.goto(shareUrl!);
  await expect(page.getByText("Secure client report")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Example Plumbing" })).toBeVisible();
  await expect(page.getByText(/Shared report version/)).toBeVisible();
  await expect(page.getByText(/These are recommended actions and planned checks/)).toBeVisible();
  expect(requestUrls.every((url) => !url.includes(E2E_SHARE_TOKEN))).toBe(true);
  expect(requestUrls.some((url) => url.includes("posthog"))).toBe(false);

  await page.goto(reportUrl);
  await page.getByRole("button", { name: "Share" }).click();
  await page.getByRole("button", { name: "Create secure link" }).click();
  await page.getByRole("button", { name: "Revoke" }).click();
  await page.goto(shareUrl!);
  await expect(page.getByRole("heading", { name: "This report link is unavailable" })).toBeVisible();
});
