import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

type Workflow = {
  on: Record<string, unknown>;
  jobs: Record<string, {
    needs?: string[];
    if?: string;
    steps: Array<{ run?: string; uses?: string; env?: Record<string, string>; with?: Record<string, unknown> }>;
  }>;
};

async function workflow(): Promise<Workflow> {
  const source = await readFile(path.resolve(process.cwd(), ".github/workflows/vercel-auto-deploy.yml"), "utf8");
  return parse(source) as Workflow;
}

async function vercelConfig(): Promise<{ git?: { deploymentEnabled?: boolean } }> {
  const source = await readFile(path.resolve(process.cwd(), "vercel.json"), "utf8");
  return JSON.parse(source) as { git?: { deploymentEnabled?: boolean } };
}

describe("Vercel deployment workflow", () => {
  it("runs quality and browser checks for pull requests and main pushes", async () => {
    const value = await workflow();
    expect(value.on).toHaveProperty("pull_request");
    expect(value.on.push).toMatchObject({ branches: ["main"] });
    expect(value.jobs.quality.steps.map((step) => step.run).filter(Boolean)).toEqual(expect.arrayContaining([
      "npm run typecheck",
      "npm test",
      "npm run contracts:check",
      "npm run build",
      "npm run security:scan",
    ]));
    expect(value.jobs.browser.steps.some((step) => step.run === "npm run test:e2e:ci")).toBe(true);
  });

  it("cannot deploy from a pull request or after a failed dependency", async () => {
    const value = await workflow();
    const deploy = value.jobs.deploy;
    expect(deploy.needs?.sort()).toEqual(["browser", "quality"]);
    expect(deploy.if).toContain("github.event_name == 'push'");
    expect(deploy.if).toContain("github.ref == 'refs/heads/main'");
    expect(deploy.if).toContain("success()");
    await expect(vercelConfig()).resolves.toMatchObject({ git: { deploymentEnabled: false } });
  });

  it("keeps the deployment hook secret out of the command and retains safe failures for seven days", async () => {
    const value = await workflow();
    const deployStep = value.jobs.deploy.steps.find((step) => step.run?.includes("curl"));
    expect(deployStep?.env?.VERCEL_HOOK_URL).toBe("${{ secrets.VERCEL_HOOK_URL }}");
    expect(deployStep?.run).toContain('\"$VERCEL_HOOK_URL\"');
    expect(deployStep?.run).not.toContain("secrets.VERCEL_HOOK_URL");

    const upload = value.jobs.browser.steps.find((step) => step.uses === "actions/upload-artifact@v4");
    expect(upload?.with?.["retention-days"]).toBe(7);
    expect(upload?.with?.path).toBe("output/playwright/prepared");
  });
});
