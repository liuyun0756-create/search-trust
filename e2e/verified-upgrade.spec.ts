import { E2E_IDS } from "./fixtures/ids";
import { verifiedReportFixture } from "./fixtures/report";
import { expect, test } from "./support/journey-test";

test.describe("Verified Generation", () => {
  test.describe("with one available credit", () => {
    test.use({ scenarioOptions: { verifiedBalance: 1, verified: "success" } });

    test("charges once, advances queued/running, and renders only actual changes", async ({ page, apiScenario }) => {
      await page.addInitScript(({ jobId }) => {
        Object.defineProperty(globalThis.crypto, "randomUUID", { value: () => jobId });
      }, { jobId: E2E_IDS.verifiedJobId });
      page.on("dialog", (dialog) => void dialog.accept());

      await page.goto(`/cases/${E2E_IDS.caseId}/connections`);
      await expect(page.getByText("All required evidence is healthy and matched to this Case.")).toBeVisible();
      await expect(page.getByText("Account balance:").locator(".."))
        .toContainText("1 credit");

      await page.getByRole("button", { name: "Generate Verified Action Plan · uses 1 credit" }).click();
      await expect(page.locator('[aria-live="polite"]'))
        .toContainText(/Verified Action Plan queued|Generating your Verified Action Plan/);
      await expect(page).toHaveURL(
        new RegExp(`/cases/${E2E_IDS.caseId}/reports/${E2E_IDS.verifiedReportId}`),
        { timeout: 20_000 },
      );

      expect(apiScenario.snapshot()).toMatchObject({
        verifiedBalance: 0,
        verifiedAttempt: 1,
        verifiedJobIds: [E2E_IDS.verifiedJobId],
      });
      await expect(page.getByText("v2 · Verified")).toBeVisible();
      await expect(page.getByRole("heading", { name: "What changed since the previous report." })).toBeVisible();
      await expect(page.locator("section#changes article"))
        .toHaveCount(verifiedReportFixture.version_diff.entries?.length ?? 0);
      await expect(page.locator("section#changes")).not.toContainText(/unchanged/i);
    });
  });

  test.describe("with no available credit", () => {
    test.use({ scenarioOptions: { verifiedBalance: 0, verified: "first_failure" } });

    test("buys without auto-generating, refunds a failed attempt, and starts a new retry job", async ({ page, apiScenario }) => {
      await page.addInitScript(({ firstJobId, retryJobId }) => {
        Object.defineProperty(globalThis.crypto, "randomUUID", {
          value: () => {
            const key = "searchtrust:e2e:verified-job-attempt";
            const attempt = Number(globalThis.sessionStorage.getItem(key) ?? "0");
            globalThis.sessionStorage.setItem(key, String(attempt + 1));
            return attempt === 0 ? firstJobId : retryJobId;
          },
        });
      }, { firstJobId: E2E_IDS.verifiedFailedJobId, retryJobId: E2E_IDS.verifiedRetryJobId });
      page.on("dialog", (dialog) => void dialog.accept());

      await page.goto(`/cases/${E2E_IDS.caseId}/connections`);
      await page.getByRole("button", { name: "Buy 1 credit · $19" }).click();
      await expect(page.getByRole("heading", { name: "Local Dodo checkout fixture" })).toBeVisible();
      await page.getByRole("link", { name: "Complete synthetic $19 purchase" }).click();

      await expect(page).toHaveURL(new RegExp(`/cases/${E2E_IDS.caseId}/connections$`));
      await expect(page.getByText("1 credit added. You can generate when you are ready.")).toBeVisible();
      await expect(page.getByText("Account balance:").locator(".."))
        .toContainText("1 credit");
      await expect(page.getByText("Generating your Verified Action Plan")).toHaveCount(0);
      expect(apiScenario.snapshot()).toMatchObject({
        verifiedBalance: 1,
        verifiedCheckoutPaid: true,
        verifiedAttempt: 0,
      });

      await page.getByRole("button", { name: "Generate Verified Action Plan · uses 1 credit" }).click();
      await expect(page.getByText("Generation failed. 1 credit returned. You can try again when ready.")).toBeVisible({ timeout: 20_000 });
      expect(apiScenario.snapshot()).toMatchObject({
        verifiedBalance: 1,
        verifiedAttempt: 1,
        verifiedFailureCompensated: true,
        verifiedJobIds: [E2E_IDS.verifiedFailedJobId],
      });

      await page.getByRole("button", { name: "Generate Verified Action Plan · uses 1 credit" }).click();
      await expect.poll(() => apiScenario.snapshot().verifiedAttempt).toBe(2);
      expect(apiScenario.snapshot()).toMatchObject({
        verifiedBalance: 0,
        verifiedAttempt: 2,
        verifiedJobIds: [E2E_IDS.verifiedFailedJobId, E2E_IDS.verifiedRetryJobId],
        verifiedPreviousJobId: E2E_IDS.verifiedFailedJobId,
      });
    });
  });
});
