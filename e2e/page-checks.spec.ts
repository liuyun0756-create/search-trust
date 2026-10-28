import {build} from "esbuild";
import {mkdtemp, mkdir} from "node:fs/promises";
import {readFileSync, readdirSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import {expect, test, type Page} from "@playwright/test";
import {owner, target, pageContext, pageSelection, pageView, checkId} from "../src/lib/page-checks/test-fixture";
import type {PageCheckContext, PageCheckSelection, PageCheckView} from "../src/lib/page-checks/types";
import type {createPageCheckHandlers as Factory} from "../src/lib/page-checks/handler";

let factory: typeof Factory, script: string, css = "";
test.beforeAll(async () => {
  if (process.env.V22_PRIORITY_VISUAL_QA === "true") css = readdirSync(".next/static/chunks").filter(s => s.endsWith(".css")).map(s => readFileSync(path.join(".next/static/chunks", s), "utf8")).join("\n");
  const resolve = createRequire(path.resolve("package.json")).resolve;
  await mkdir("output/playwright/integration", {recursive: true});
  const directory = await mkdtemp(path.resolve("output/playwright/integration/page-check-"));
  await build({entryPoints: ["e2e/integration/page-check-gateway.ts"], outfile: path.join(directory, "gateway.mjs"), bundle: true,
    platform: "node", format: "esm", packages: "external", plugins: [{name: "resolve-ajv", setup(b) {b.onResolve({filter: /^ajv\/dist\/2020$/}, a => ({path: resolve(a.path), external: true}));}}]});
  ({createPageCheckHandlers: factory} = await import(pathToFileURL(path.join(directory, "gateway.mjs")).href));
  const browser = await build({entryPoints: ["e2e/integration/page-check-browser.tsx"], bundle: true, write: false, platform: "browser", jsx: "automatic", define: {"process.env.NODE_ENV": '"test"'}});
  script = browser.outputFiles[0].text;
});

async function mount(page: Page, loss: "none" | "before" | "after" = "none") {
  const catalog = structuredClone(pageContext), saved = new Map<string, PageCheckView>(), commands: {operation: string; check_id: string; selection: PageCheckSelection}[] = [], errors: string[] = [];
  let first = true, failRead = loss === "after", account = owner;
  const gateway = factory({enabled: () => true, user: async () => ({userId: account}), config: () => ({baseUrl: "https://backend.invalid", token: "test"}),
    fetch: async (_url, init) => {
      const c = JSON.parse(init!.body as string); commands.push(c);
      if (c.operation === "context") return Response.json(catalog);
      if (c.operation === "read") {
        if (failRead) {failRead = false; throw new Error("unavailable once");}
        return saved.has(c.check_id) ? Response.json(saved.get(c.check_id)) : Response.json({code: "NOT_FOUND"}, {status: 404});
      }
      if (first && loss === "before") {first = false; throw new Error("lost before commit");}
      if (!saved.has(c.check_id)) {
        const v = pageView(c.check_id, "queued", c.selection); saved.set(v.id, v);
        const {schema_version, selection, observation, site_url, delivery_revision, ...summary} = v;
        catalog.history.unshift(summary); catalog.limits = {...catalog.limits, used: 1, active: true, reason: "active", next_request_at: "2026-10-26T01:05:00Z"};
      }
      if (first && loss === "after") {first = false; throw new Error("lost acknowledgement");}
      return Response.json(saved.get(c.check_id));
    }});
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== "http://127.0.0.1:3100") return route.abort();
    if (req.isNavigationRequest()) return route.fulfill({contentType: "text/html", body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/page-check.js"></script></body></html>`});
    if (url.pathname === "/page-check.js") return route.fulfill({contentType: "application/javascript", body: script});
    const result = await gateway[req.method() === "POST" ? "POST" : "GET"](new Request(req.url(), {method: req.method(), headers: {...await req.allHeaders(), host: url.host}, body: req.postData()}), {params: Promise.resolve({id: target.caseId, reportId: target.reportId})});
    await route.fulfill({status: result.status, headers: Object.fromEntries(result.headers), body: await result.text()});
  });
  await page.goto("/page-check-test"); await page.waitForLoadState("networkidle");
  return {catalog, saved, commands, errors, switchOwner: (next: string) => {account = next;}};
}
async function fill(page: Page) {
  await page.getByLabel("Page URL", {exact: true}).fill(pageSelection.target_url);
  await page.getByLabel("Condition 1 value", {exact: true}).fill("Repair service");
  await page.getByRole("checkbox").check();
}

test("explicit consent, read-only history, result limitations and responsive labels", async ({page}, info) => {
  const m = await mount(page), submit = page.getByRole("button", {name: "Check this page · no credits used"});
  await expect(submit).toBeDisabled(); await expect(page.getByRole("checkbox")).not.toBeChecked();
  expect(m.commands.map(c => c.operation)).toEqual(["context"]);
  await fill(page); await expect(submit).toBeEnabled();
  await page.getByLabel("Saved action", {exact: true}).selectOption("action-2"); await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("checkbox").check(); await page.getByLabel("Condition 1 type").selectOption("anchor_present"); await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("checkbox").check(); await page.getByRole("button", {name: "Add condition"}).click(); await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("button", {name: "Remove condition 2"}).click();
  await page.getByLabel("Condition 1 type").selectOption("text_present"); await page.getByRole("checkbox").check();
  m.catalog.implementation!.revision = 2;
  await page.getByRole("button", {name: "Refresh status and availability"}).click(); await expect(page.getByRole("checkbox")).not.toBeChecked();
  await fill(page);
  // Keyboard submission uses the same explicit confirmation path.
  await submit.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("article", {name: "Saved page check"}).getByRole("heading", {name: "Waiting to check"})).toBeVisible();
  const id = [...m.saved.keys()][0], selection = m.saved.get(id)!.selection;
  expect(selection.implementation.revision).toBe(2);
  const done = pageView(id, "completed", selection); done.observation!.results[0].state = "not_observed"; m.saved.set(id, done);
  m.catalog.history[0].status = "completed"; m.catalog.history[0].completed_at = done.completed_at;
  m.catalog.limits.active = false; m.catalog.limits.reason = "cooldown";
  await page.getByRole("button", {name: "Refresh status and availability"}).click();
  await expect(page.getByText("Not observed", {exact: true})).toBeVisible();
  await expect(page.getByText("Not found in the checked static response; rendered content may differ.")).toBeVisible();
  await page.getByRole("button", {name: /View saved check/}).click();
  expect(m.commands.filter(c => c.operation === "request")).toHaveLength(1);
  await expect(page.getByText(/You can request another check after/)).toBeVisible();
  if (css) {
    await page.setViewportSize({width: 1280, height: 1000}); await page.screenshot({path: info.outputPath("page-check-desktop.png"), fullPage: true});
    await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: info.outputPath("page-check-mobile.png"), fullPage: true});
  }
  expect(m.errors).toEqual([]);
});

test("lost commit acknowledgement survives reload with GET only", async ({page}) => {
  const m = await mount(page, "after"); await fill(page);
  await page.getByRole("button", {name: "Check this page · no credits used"}).click();
  await expect(page.getByText(/Keep this request ID/)).toBeVisible();
  await expect(page.getByLabel("Page URL", {exact: true})).toBeDisabled();
  await page.reload(); await page.waitForLoadState("networkidle");
  await expect(page.getByText("Original request recovered. No additional check was created.")).toBeVisible();
  expect(m.commands.filter(c => c.operation === "request")).toHaveLength(1); expect(m.saved.size).toBe(1);
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith("v22:page-check:")))).toEqual([]);
});

test("missing original request requires an explicit same-ID recovery", async ({page}) => {
  const m = await mount(page, "before"); await fill(page);
  await page.getByRole("button", {name: "Check this page · no credits used"}).click();
  await expect(page.getByRole("button", {name: "Recover the same confirmed request"})).toBeVisible();
  await page.reload(); await page.waitForLoadState("networkidle");
  expect(m.commands.filter(c => c.operation === "request")).toHaveLength(1);
  await page.getByRole("button", {name: "Recover the same confirmed request"}).click();
  await expect(page.getByText("Page check request saved. No credits used.")).toBeVisible();
  const posts = m.commands.filter(c => c.operation === "request"); expect(posts).toHaveLength(2); expect(posts[0]).toEqual(posts[1]); expect(m.saved.size).toBe(1);
});

test("account and delivery changes do not load another pending selection", async ({page}) => {
  const m = await mount(page, "before"); await fill(page);
  await page.getByRole("button", {name: "Check this page · no credits used"}).click();
  await expect(page.getByRole("button", {name: "Recover the same confirmed request"})).toBeVisible();
  m.switchOwner(checkId); const reads = m.commands.filter(c => c.operation === "read").length;
  await page.goto(`/page-check-test?owner=${checkId}`); await page.waitForLoadState("networkidle");
  expect(m.commands.filter(c => c.operation === "read")).toHaveLength(reads);
  await expect(page.getByLabel("Page URL", {exact: true})).toHaveValue("");
  await expect(page.getByRole("button", {name: "Recover the same confirmed request"})).toHaveCount(0);
  await page.goto(`/page-check-test?delivery=${checkId}`); await page.waitForLoadState("networkidle");
  expect(m.commands.filter(c => c.operation === "read")).toHaveLength(reads);
  expect(m.commands.filter(c => c.operation === "request")).toHaveLength(1);
});

test("source changes preserve history and failed/unable states stay bounded", async ({page}) => {
  const m = await mount(page);
  const done = pageView(checkId, "completed"); done.observation!.status = "unable_to_check"; done.observation!.failure = "robots_disallowed"; done.observation!.results[0].state = "unable_to_check";
  m.saved.set(checkId, done);
  const {schema_version, selection, observation, site_url, delivery_revision, ...summary} = done;
  m.catalog.history = [summary]; m.catalog.eligibility = "source_changed";
  await page.getByRole("button", {name: "Refresh status and availability"}).click();
  await expect(page.getByText(/Your authorized history remains below/)).toBeVisible();
  await page.getByRole("button", {name: /View saved check/}).click();
  await expect(page.getByRole("heading", {name: "Could not check this page"})).toBeVisible();
  await expect(page.getByText("The site's crawl instructions do not allow this check.")).toBeVisible();
  m.saved.set(checkId, pageView(checkId, "failed")); await page.getByRole("button", {name: "Refresh status and availability"}).click();
  await expect(page.getByRole("heading", {name: "Check interrupted"})).toBeVisible();
  expect(m.commands.every(c => c.operation !== "request")).toBe(true);
});
