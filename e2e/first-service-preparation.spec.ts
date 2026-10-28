import { build } from "esbuild";
import { readdir, readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { preflightFixture } from "./fixtures/preflight";

let script: string;
let css: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: ["e2e/integration/first-service-browser.tsx"], bundle: true, write: false,
    platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"test"',
      "process.env.NEXT_PUBLIC_E2E_TEST_MODE": '"false"', "process.env.NEXT_PUBLIC_E2E_BASE_URL": '""', "process.env.VERCEL_ENV": '""' }, plugins: [{
      name: "test-only-preparation-navigation", setup(builder) {
        builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "router", namespace: "test-router" }));
        builder.onLoad({ filter: /.*/, namespace: "test-router" }, () => ({ contents: `export const useRouter=()=>({
          push:(path)=>{history.pushState(null,"",path);window.dispatchEvent(new Event("setup-navigation"));},
          refresh:()=>window.dispatchEvent(new Event("setup-refresh"))});` }));
        builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "test-link" }));
        builder.onLoad({ filter: /.*/, namespace: "test-link" }, () => ({ contents: 'import React from "react"; export default function Link(props){return React.createElement("a",props);}', resolveDir: process.cwd() }));
      },
    }] });
  script = result.outputFiles[0].text;
  const files = await readdir(".next/static/chunks");
  css = (await Promise.all(files.filter((file) => file.endsWith(".css")).map((file) => readFile(`.next/static/chunks/${file}`, "utf8")))).join("\n");
  expect(css.length).toBeGreaterThan(1000);
});

for (const width of [1280, 390]) test(`prepares a client without report intake or payment at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const calls: { method: string; path: string }[] = [], external: string[] = [];
  const errors: string[] = [];
  let createdId: string | null = null;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3100") { external.push(url.origin); return route.abort(); }
    if (request.isNavigationRequest()) return route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/_setup/styles.css"></head><body><div id="root"></div><script src="/_setup/app.js"></script></body></html>' });
    if (url.pathname === "/_setup/app.js") return route.fulfill({ contentType: "application/javascript", body: script });
    if (url.pathname === "/_setup/styles.css") return route.fulfill({ contentType: "text/css", body: css });
    if (!url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "" });
    calls.push({ method: request.method(), path: url.pathname });
    if (url.pathname === "/api/v2/preflight") return route.fulfill({ json: { ...preflightFixture, identity_candidates: preflightFixture.identity_candidates.map((candidate) => ({ ...candidate, business: { ...candidate.business, public_gbp_url: "https://www.google.com/maps?cid=123456" } })) } });
    if (url.pathname === "/api/v2/cases" && request.method() === "POST") {
      createdId = request.postDataJSON().draft_case_id;
      return route.fulfill({ status: 201, json: { id: createdId, status: "active" } });
    }
    if (url.pathname === "/api/v2/google/connections") return route.fulfill({ json: { connections: [] } });
    if (createdId && url.pathname === `/api/v2/cases/${createdId}/google-resources`) return route.fulfill({ json: { bindings: [] } });
    throw new Error(`Unexpected preparation request: ${request.method()} ${url.pathname}`);
  });
  await page.goto("/cases/service/new");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Start with the client you already serve." })).toBeVisible();
  await page.getByLabel("Business website").fill("example.com");
  await page.getByRole("button", { name: "Check business details" }).click();
  await page.getByRole("button", { name: "Save client and connect data" }).click();
  await expect(page.getByRole("heading", { name: "Connect evidence for SearchTrust E2E Plumbing." })).toBeVisible();
  await expect(page.getByRole("button", { name: "First-service analysis · not yet available" })).toBeDisabled();
  await page.getByRole("button", { name: "Refresh status" }).click();
  await page.reload(); await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "First-service analysis · not yet available" })).toBeDisabled();
  expect(calls.filter((item) => item.method === "POST").map((item) => item.path)).toEqual(["/api/v2/preflight", "/api/v2/cases"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]); expect(external).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`preparation-${width}.png`), fullPage: true });
});
