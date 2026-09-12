#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TARGET_PROJECT,
  VALIDATION_MODES,
  assertApprovedProject,
  assertMigrationParity,
  assertTransactionOnlySql,
  boundedJson,
  commandEvidence,
  parseSupabaseJson,
} from "./v22-data-migration-safety.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supabaseRoot = path.join(root, "supabase");
const validationSql = path.join(supabaseRoot, "tests/database/v22_release_validation.test.sql");
const residueSql = path.join(supabaseRoot, "tests/database/v22_release_residue.test.sql");

function argument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(3).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length).trim() : null;
}

function supabase(args, timeout = 120_000) {
  return execFileSync("npx", ["supabase", ...args], {
    cwd: root,
    encoding: "utf8",
    timeout,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function localMigrationVersions() {
  return readdirSync(path.join(supabaseRoot, "migrations"))
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort()
    .map((name) => name.slice(0, 14));
}

function approvedRemoteState() {
  const linkedRef = readFileSync(path.join(supabaseRoot, ".temp/project-ref"), "utf8").trim();
  const projects = parseSupabaseJson(supabase(["projects", "list", "-o", "json"]));
  const project = assertApprovedProject(projects, linkedRef);
  const migrationResult = parseSupabaseJson(supabase(["migration", "list", "--linked"]));
  const parity = assertMigrationParity(localMigrationVersions(), migrationResult.migrations ?? []);
  return { project, parity };
}

function runSql(file, target) {
  const sql = readFileSync(file, "utf8");
  const contract = assertTransactionOnlySql(sql);
  const output = supabase(["test", "db", target, file], 300_000);
  return { contract, evidence: commandEvidence(output) };
}

function main() {
  const mode = process.argv[2];
  if (!VALIDATION_MODES.includes(mode)) throw new Error("VALIDATION_MODE_INVALID");

  if (mode === "baseline") {
    const state = approvedRemoteState();
    const tableStats = parseSupabaseJson(supabase(["inspect", "db", "table-stats", "--linked"]));
    const tables = (tableStats.rows ?? []).map((row) => ({
      name: row.name,
      estimatedRowCount: String(row.estimated_row_count),
    }));
    process.stdout.write(boundedJson({ ok: true, mode, ...state, tables }));
    return;
  }

  if (mode === "local") {
    const validation = runSql(validationSql, "--local");
    const residue = runSql(residueSql, "--local");
    process.stdout.write(boundedJson({ ok: true, mode, validation, residue }));
    return;
  }

  const state = approvedRemoteState();
  if (argument("confirm-project") !== TARGET_PROJECT.ref) {
    throw new Error("REMOTE_PROJECT_CONFIRMATION_REQUIRED");
  }
  const file = mode === "remote" ? validationSql : residueSql;
  const result = runSql(file, "--linked");
  process.stdout.write(boundedJson({ ok: true, mode, ...state, result }));
}

try {
  main();
} catch (error) {
  const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "V22_MIGRATION_VALIDATION_FAILED";
  process.stdout.write(boundedJson({ ok: false, code }));
  process.exitCode = 1;
}
