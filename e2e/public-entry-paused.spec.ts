import { expect, test } from "@playwright/test";

test("paused intake blocks new work while read and settlement routes remain reachable", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "paused-intake", "Runs with the dedicated fail-closed server fixture.");

  await page.goto("/cases/new");
  await expect(page.getByRole("heading", { name: "We’re briefly pausing new SearchTrust reports." })).toBeVisible();
  await expect(page.getByText("No saved Case or report is being deleted or changed by this pause.")).toBeVisible();

  const writes = [
    ["/api/v2/preflight", {}],
    ["/api/v2/competitors/discover", {}],
    ["/api/v2/competitors/tasks/e2000000-0000-4000-8000-000000000099/retry", {}],
    ["/api/v2/cases", {}],
    ["/api/v2/analyze", {}],
    ["/api/v2/cases/e2000000-0000-4000-8000-000000000101/checkout", {}],
  ] as const;
  for (const [url, data] of writes) {
    const response = await request.post(url, { data });
    expect(response.status(), url).toBe(503);
    expect(await response.json(), url).toEqual({
      error: {
        code: "V22_PUBLIC_ENTRY_PAUSED",
        message: "New report intake is temporarily paused. Existing Cases and reports remain available.",
      },
    });
  }

  const read = await request.get("/api/v2/cases");
  expect(await read.text()).not.toContain("V22_PUBLIC_ENTRY_PAUSED");

  const settlement = await request.post(
    "/api/v2/cases/e2000000-0000-4000-8000-000000000101/checkout/confirm",
    { data: { payment_id: "searchtrust_e2e_payment" } },
  );
  expect(await settlement.text()).not.toContain("V22_PUBLIC_ENTRY_PAUSED");
});
