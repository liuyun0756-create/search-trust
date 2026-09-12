#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APPROVED_RELEASE_TARGETS = Object.freeze({
  vercel: Object.freeze({
    projectId: "prj_881acLLmpttUjjW1YdFHm3sDCsrD",
    orgId: "team_6JDpKpxDCsrTALYwkj8rFMZ5",
    projectName: "search-trust",
    productionAlias: "trysearchtrust.com",
  }),
  railway: Object.freeze({
    projectId: "3e69fdd3-3241-412c-b224-6bf468bc5b15",
    projectName: "energetic-fulfillment",
    environmentId: "2c547ad1-4cad-44e2-a759-cfc49e1622c3",
    environmentName: "production",
    webServiceId: "f3a526ab-b156-4223-a0ef-c7aa886b3b4f",
    webServiceName: "SearchTrust-RD",
    workerServiceId: "fd8d13e2-3546-4bf2-a02a-5f018a0550a8",
    workerServiceName: "SearchTrust-v2-2-Worker-Production",
    healthUrl: "https://searchtrust-rd-production.up.railway.app/api/v1/health",
  }),
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERIFICATION_TIMEOUT_MS = 180_000;

function argument(argv, name) {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

export function parseControlArguments(argv) {
  const direction = argv[0];
  if (!['close', 'open'].includes(direction)) throw new Error("CONTROL_DIRECTION_REQUIRED");
  return {
    direction,
    execute: argv.includes("--execute"),
    confirmations: {
      vercelProject: argument(argv, "confirm-vercel-project"),
      railwayProject: argument(argv, "confirm-railway-project"),
      railwayEnvironment: argument(argv, "confirm-railway-environment"),
      railwayWeb: argument(argv, "confirm-railway-web"),
      railwayWorker: argument(argv, "confirm-railway-worker"),
    },
  };
}

export function assertControlConfirmations(confirmations) {
  const expected = APPROVED_RELEASE_TARGETS;
  if (confirmations.vercelProject !== expected.vercel.projectId) throw new Error("VERCEL_PROJECT_CONFIRMATION_REQUIRED");
  if (confirmations.railwayProject !== expected.railway.projectId) throw new Error("RAILWAY_PROJECT_CONFIRMATION_REQUIRED");
  if (confirmations.railwayEnvironment !== expected.railway.environmentId) throw new Error("RAILWAY_ENVIRONMENT_CONFIRMATION_REQUIRED");
  if (confirmations.railwayWeb !== expected.railway.webServiceId) throw new Error("RAILWAY_WEB_CONFIRMATION_REQUIRED");
  if (confirmations.railwayWorker !== expected.railway.workerServiceId) throw new Error("RAILWAY_WORKER_CONFIRMATION_REQUIRED");
}

export function buildControlPlan(direction) {
  if (!['close', 'open'].includes(direction)) throw new Error("CONTROL_DIRECTION_REQUIRED");
  const value = direction === "open" ? "true" : "false";
  const { vercel, railway } = APPROVED_RELEASE_TARGETS;
  const railwayArgs = ["--project", railway.projectId, "--environment", railway.environmentId];
  return {
    direction,
    value,
    commands: [
      {
        label: "Vercel production entry",
        executable: "npx",
        args: [
          "vercel", "env", "add", "V22_PUBLIC_ENTRY_ENABLED", "production",
          "--value", value, "--force", "--yes", "--no-sensitive",
          "--project", vercel.projectId, "--scope", vercel.orgId,
        ],
      },
      {
        label: "Railway production web",
        executable: "railway",
        args: [
          "variable", "set",
          `V22_ANALYZE_ENABLED=${value}`,
          `V22_PREFLIGHT_ENABLED=${value}`,
          `V22_COMPETITOR_DISCOVERY_ENABLED=${value}`,
          ...railwayArgs, "--service", railway.webServiceId,
        ],
      },
      {
        label: "Railway production worker",
        executable: "railway",
        args: [
          "variable", "set", `V22_ANALYZE_ENABLED=${value}`,
          ...railwayArgs, "--service", railway.workerServiceId,
        ],
      },
      {
        label: "Vercel production redeploy",
        executable: "npx",
        args: [
          "vercel", "redeploy", vercel.productionAlias,
          "--target", "production", "--scope", vercel.orgId,
        ],
      },
    ],
    preview: {
      mode: "dry-run",
      direction,
      targets: [
        vercel.projectName,
        `${railway.projectName}/${railway.environmentName}/${railway.webServiceName}`,
        `${railway.projectName}/${railway.environmentName}/${railway.workerServiceName}`,
      ],
      changes: [
        `Vercel production: V22_PUBLIC_ENTRY_ENABLED=${value}`,
        `Railway web: V22_ANALYZE_ENABLED=${value}, V22_PREFLIGHT_ENABLED=${value}, V22_COMPETITOR_DISCOVERY_ENABLED=${value}`,
        `Railway worker: V22_ANALYZE_ENABLED=${value}`,
      ],
      checks: [
        "Vercel production deployment becomes Ready",
        "Railway Web and Worker deployments become Success",
        "Backend /api/v1/health returns HTTP 200",
        direction === "close"
          ? "New Case page displays the paused state and Case reads remain reachable"
          : "New Case page displays the open intake and Case reads remain reachable",
      ],
    },
  };
}

export function executeMutationPlan(plan, runner = (executable, args) => execFileSync(executable, args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 300_000,
  maxBuffer: 4 * 1024 * 1024,
})) {
  for (const command of plan.commands) runner(command.executable, command.args);
}

function commandJson(executable, args) {
  const output = execFileSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const firstObject = Math.min(...[output.indexOf("{"), output.indexOf("[")].filter((index) => index >= 0));
  if (!Number.isFinite(firstObject)) throw new Error("CONTROL_TARGET_JSON_INVALID");
  return JSON.parse(output.slice(firstObject));
}

function assertLiveTargets() {
  const linked = JSON.parse(readFileSync(path.join(root, ".vercel/project.json"), "utf8"));
  const { vercel, railway } = APPROVED_RELEASE_TARGETS;
  if (linked.projectId !== vercel.projectId || linked.orgId !== vercel.orgId) throw new Error("VERCEL_LINK_TARGET_MISMATCH");

  const project = commandJson("npx", [
    "vercel", "project", "inspect", vercel.projectId,
    "--scope", vercel.orgId, "--json",
  ]);
  if (project.id !== vercel.projectId || project.name !== vercel.projectName) throw new Error("VERCEL_LIVE_TARGET_MISMATCH");

  const status = commandJson("railway", ["status", "--json"]);
  if (status.id !== railway.projectId || status.name !== railway.projectName) throw new Error("RAILWAY_LIVE_PROJECT_MISMATCH");
  const environment = status.environments?.edges?.map((edge) => edge.node)
    .find((candidate) => candidate.id === railway.environmentId && candidate.name === railway.environmentName);
  if (!environment) throw new Error("RAILWAY_LIVE_ENVIRONMENT_MISMATCH");
  const services = new Map(environment.serviceInstances?.edges?.map((edge) => [edge.node.serviceId, edge.node.serviceName]));
  if (services.get(railway.webServiceId) !== railway.webServiceName) throw new Error("RAILWAY_LIVE_WEB_MISMATCH");
  if (services.get(railway.workerServiceId) !== railway.workerServiceName) throw new Error("RAILWAY_LIVE_WORKER_MISMATCH");
}

async function waitFor(predicate) {
  const started = Date.now();
  while (Date.now() - started < VERIFICATION_TIMEOUT_MS) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error("CONTROL_DEPLOYMENT_TIMEOUT");
}

async function verifyRailwayService(serviceId) {
  const { railway } = APPROVED_RELEASE_TARGETS;
  await waitFor(async () => {
    const deployments = commandJson("railway", [
      "deployment", "list", "--json", "--limit", "1",
      "--project", railway.projectId, "--environment", railway.environmentId,
      "--service", serviceId,
    ]);
    return Array.isArray(deployments) && deployments[0]?.status === "SUCCESS";
  });
}

async function verifyHttp(direction) {
  const { vercel, railway } = APPROVED_RELEASE_TARGETS;
  await waitFor(async () => (await fetch(railway.healthUrl, { cache: "no-store" })).status === 200);
  await waitFor(async () => {
    const response = await fetch(`https://${vercel.productionAlias}/cases/new`, { cache: "no-store" });
    if (response.status !== 200) return false;
    const body = await response.text();
    return direction === "close"
      ? body.includes("New report intake paused")
      : !body.includes("New report intake paused");
  });
  const readResponse = await fetch(`https://${vercel.productionAlias}/api/v2/cases`, { cache: "no-store" });
  if (readResponse.status === 503) throw new Error("CONTROL_EXISTING_READ_BLOCKED");
}

async function main() {
  const parsed = parseControlArguments(process.argv.slice(2));
  const plan = buildControlPlan(parsed.direction);
  if (!parsed.execute) {
    process.stdout.write(`${JSON.stringify(plan.preview, null, 2)}\n`);
    return;
  }
  assertControlConfirmations(parsed.confirmations);
  assertLiveTargets();
  executeMutationPlan(plan);
  await Promise.all([
    verifyRailwayService(APPROVED_RELEASE_TARGETS.railway.webServiceId),
    verifyRailwayService(APPROVED_RELEASE_TARGETS.railway.workerServiceId),
  ]);
  await verifyHttp(parsed.direction);
  process.stdout.write(`${JSON.stringify({ ok: true, direction: parsed.direction, checks: plan.preview.checks })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "V22_PUBLIC_ENTRY_CONTROL_FAILED";
    process.stdout.write(`${JSON.stringify({ ok: false, code })}\n`);
    process.exitCode = 1;
  });
}
