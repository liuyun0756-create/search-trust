import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const dir = path.resolve(import.meta.dirname, "../output/site-report-preview");
const html = readFileSync(path.join(dir, "index.html"));
const server = createServer((req, res) => {
  if (req.url !== "/") { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const errors = [], external = [], writes = [], checks = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const request = route.request();
      if (request.method() !== "GET") writes.push(request.url());
      if (new URL(request.url()).origin !== origin) { external.push(request.url()); return route.abort(); }
      return route.continue();
    });
    await page.goto(origin);
    const reader = page.getByLabel("Scrollable report", { exact: true });
    await page.getByRole("tab", { name: /Prospect report/ }).waitFor();
    assert.equal(await page.getByRole("tab", { name: /Prospect report/ }).getAttribute("aria-selected"), "true");
    assert.match(await page.getByRole("region", { name: "Findings", exact: true }).innerText(), /503/);
    checks.push(`${width}: actual Prospect source and default selection`);
    await page.getByRole("button", { name: /Action plan/ }).click();
    assert.ok(await reader.evaluate(el => el.scrollTop) > 0);
    const target = page.getByRole("region", { name: "Action plan", exact: true });
    const box = await target.boundingBox(), viewport = await reader.boundingBox();
    assert.ok(box.y >= viewport.y && box.y < viewport.y + 80);
    checks.push(`${width}: chapter navigation stays inside reader`);
    await page.getByRole("tab", { name: /Verified plan/ }).click();
    assert.equal(await reader.evaluate(el => el.scrollTop), 0);
    assert.match(await page.getByRole("region", { name: "Findings", exact: true }).innerText(), /750/);
    assert.equal(await page.getByRole("region", { name: "Action plan", exact: true }).locator(":scope > section").count(), 3);
    await page.getByRole("button", { name: /Action plan/ }).click();
    const details = page.getByText("Inspect the priority basis", { exact: true }).first();
    await details.click();
    assert.equal(await details.evaluate(el => el.parentElement.open), true);
    checks.push(`${width}: complete service plan, source values and priority details`);
    await page.getByRole("tab", { name: /Verified plan/ }).focus();
    await page.keyboard.press("End");
    await page.getByRole("heading", { name: "No action proposed yet" }).waitFor();
    assert.match(await page.getByRole("tabpanel").innerText(), /1 credit; it is not refunded/);
    assert.equal(await page.getByRole("region", { name: "Action plan", exact: true }).locator(":scope > section").count(), 0);
    checks.push(`${width}: keyboard navigation and zero-action diagnosis`);
    await page.keyboard.press("Home");
    assert.equal(await page.getByRole("tab", { name: /Prospect report/ }).getAttribute("aria-selected"), "true");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await reader.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({ path: path.join(dir, width === 1440 ? "desktop.png" : "mobile.png"), fullPage: true });
    checks.push(`${width}: no horizontal overflow`);
    await page.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
  const result = { ok: true, checks, errors, external, writes };
  writeFileSync(path.join(dir, "browser-check.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
