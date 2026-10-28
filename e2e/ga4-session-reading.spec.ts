import {build} from "esbuild";
import {mkdtemp, mkdir} from "node:fs/promises";
import {readFileSync, readdirSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import {expect, test, type Page} from "@playwright/test";
import {reading, target} from "../src/lib/ga4-session-readings/test-fixture";
import type {createGa4SessionHandler as Factory} from "../src/lib/ga4-session-readings/handler";

let factory: typeof Factory, script: string, css = "";
test.beforeAll(async () => {
  if (process.env.V22_PRIORITY_VISUAL_QA === "true") css = readdirSync(".next/static/chunks").filter(s => s.endsWith(".css")).map(s => readFileSync(path.join(".next/static/chunks", s), "utf8")).join("\n");
  const resolve = createRequire(path.resolve("package.json")).resolve;
  await mkdir("output/playwright/integration", {recursive: true});
  const directory = await mkdtemp(path.resolve("output/playwright/integration/session-"));
  await build({entryPoints: ["e2e/integration/ga4-session-gateway.ts"], outfile: path.join(directory, "gateway.mjs"), bundle: true,
    platform: "node", format: "esm", packages: "external", plugins: [{name: "resolve-ajv", setup(b) {b.onResolve({filter: /^ajv\/dist\/2020$/}, a => ({path: resolve(a.path), external: true}));}}]});
  ({createGa4SessionHandler: factory} = await import(pathToFileURL(path.join(directory, "gateway.mjs")).href));
  const browser = await build({entryPoints: ["e2e/integration/ga4-session-browser.tsx"], bundle: true, write: false, platform: "browser", jsx: "automatic", define: {"process.env.NODE_ENV": '"test"'}});
  script = browser.outputFiles[0].text;
});
async function mount(page: Page, mode: "normal" | "withheld" | "retry" | "zero" = "normal") {
  const commands: unknown[] = [], errors: string[] = []; let failed = false;
  const gateway = factory({enabled: () => true, user: async () => ({userId: reading().user_id}), config: () => ({baseUrl: "https://backend.invalid", token: "test"}),
    fetch: async (_url, init) => {
      commands.push(JSON.parse(init!.body as string));
      if (mode === "retry" && !failed) {failed = true; throw new Error("offline");}
      const r = reading();
      if (mode === "withheld") Object.assign(r, {state: "withheld", reasons: ["DATES_NOT_RETURNED"], before: null, after: null, difference: null, relative_change_percent: null});
      if (mode === "zero") Object.assign(r, {before: 0, after: 12, difference: 12, relative_change_percent: null});
      return Response.json(r);
    }});
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== "http://127.0.0.1:3100") return route.abort();
    if (req.isNavigationRequest()) return route.fulfill({contentType: "text/html", body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/session.js"></script></body></html>`});
    if (url.pathname === "/session.js") return route.fulfill({contentType: "application/javascript", body: script});
    expect(req.method()).toBe("GET"); expect(url.pathname).toContain("ga4-session-readings");
    const r = await gateway(new Request(req.url(), {headers: await req.allHeaders()}), {params: Promise.resolve({id: target.caseId, reportId: target.reportId})});
    await route.fulfill({status: r.status, headers: Object.fromEntries(r.headers), body: await r.text()});
  });
  await page.goto("/session-test"); return {commands, errors};
}

test("keyboard reading, source labels, neutral numbers and responsive layout", async ({page}, info) => {
  const m = await mount(page); const button = page.getByRole("button", {name: "View saved session counts"});
  await expect(button).toBeVisible(); expect(m.commands).toEqual([]);
  await button.focus(); await page.keyboard.press("Enter");
  await expect(page.getByText("+25.00%", {exact: true})).toBeVisible();
  await expect(page.getByText(/not a measure of the effect/)).toBeVisible();
  await expect(page.getByText(/Organic Search · America/)).toBeVisible();
  for (const width of [1280,390]) {
    await page.setViewportSize({width, height: 950});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: info.outputPath(`sessions-${width}.png`), fullPage: true});
  }
  expect(m.commands).toHaveLength(1); expect(m.errors).toEqual([]);
});
test("withheld dates are not zero filled", async ({page}) => {
  const m = await mount(page, "withheld"); await page.getByRole("button").click();
  await expect(page.getByText(/Missing rows are not treated as zero/)).toBeVisible();
  await expect(page.getByText("Count difference", {exact: true})).toHaveCount(0);
  expect(m.commands).toHaveLength(1); expect(m.errors).toEqual([]);
});
test("retry only reads the same saved source", async ({page}) => {
  const m = await mount(page, "retry"); await page.getByRole("button").click();
  await page.getByRole("button", {name: "Retry reading saved counts"}).click();
  await expect(page.getByText("+25.00%", {exact: true})).toBeVisible();
  expect(m.commands).toHaveLength(2); expect(m.commands[0]).toEqual(m.commands[1]); expect(m.errors).toEqual([]);
});
test("zero baseline cannot produce a percentage", async ({page}) => {
  await mount(page, "zero"); await page.getByRole("button").click();
  await expect(page.getByText("Not calculated: the before count is zero.")).toBeVisible();
  await expect(page.getByText("+12", {exact: true})).toBeVisible();
});
