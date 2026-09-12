import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  TARGET_PROJECT,
  assertApprovedProject,
  assertMigrationParity,
  assertTransactionOnlySql,
  boundedJson,
  commandEvidence,
  parseSupabaseJson,
  redactSensitiveText,
} from "../../../scripts/v22-data-migration-safety.mjs";

const root = process.cwd();

describe("V22-092 migration release validation safety", () => {
  it("accepts only the approved linked project", () => {
    const projects = [{ id: TARGET_PROJECT.ref, name: TARGET_PROJECT.name, region: TARGET_PROJECT.region, status: TARGET_PROJECT.status }];
    expect(assertApprovedProject(projects, TARGET_PROJECT.ref)).toEqual(TARGET_PROJECT);
    expect(() => assertApprovedProject(projects, "another-project")).toThrow("UNAPPROVED_LINKED_PROJECT");
    expect(() => assertApprovedProject([{ ...projects[0], status: "INACTIVE" }], TARGET_PROJECT.ref))
      .toThrow("PROJECT_STATUS_MISMATCH");
  });

  it("requires exact ordered migration parity", () => {
    expect(assertMigrationParity(["1", "2"], [
      { local: "1", remote: "1" }, { local: "2", remote: "2" },
    ])).toEqual({ count: 2, first: "1", last: "2" });
    expect(() => assertMigrationParity(["1", "2"], [
      { local: "1", remote: "1" }, { local: "2", remote: "3" },
    ])).toThrow("MIGRATION_HISTORY_DRIFT");
    expect(() => assertMigrationParity(["1", "2"], [
      { local: "1", remote: "1" }, { local: "2", remote: "1" },
    ])).toThrow("MIGRATION_VERSION_DUPLICATE");
  });

  it("accepts one rollback transaction and rejects destructive SQL", () => {
    expect(assertTransactionOnlySql("begin; select 1; update public.t set x=1 where id=2; rollback;"))
      .toMatchObject({ statements: 4 });
    for (const sql of [
      "select 1;",
      "begin; select 1; commit;",
      "begin; drop table public.users; rollback;",
      "begin; truncate public.users; rollback;",
      "begin; delete from public.users; rollback;",
      "begin; update public.users set email='x'; rollback;",
      "begin; delete from supabase_migrations.schema_migrations where version='1'; rollback;",
    ]) expect(() => assertTransactionOnlySql(sql)).toThrow();
  });

  it("keeps both release SQL suites rollback-only and residue-addressable", async () => {
    const validation = await readFile(
      path.join(root, "supabase/tests/database/v22_release_validation.test.sql"),
      "utf8",
    );
    const residue = await readFile(
      path.join(root, "supabase/tests/database/v22_release_residue.test.sql"),
      "utf8",
    );
    expect(assertTransactionOnlySql(validation)).toMatchObject({ digest: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(assertTransactionOnlySql(residue)).toMatchObject({ digest: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(validation).toContain("v22-release-validation-20260912");
    expect(residue).toContain("v22-release-validation-%");
    expect(validation.toLowerCase()).not.toMatch(/\bcommit\b/);
  });

  it("ships the approved server-only report-share privilege remediation", async () => {
    const migration = await readFile(
      path.join(root, "supabase/migrations/20260912100000_restrict_v2_2_report_share_rotation.sql"),
      "utf8",
    );
    expect(migration).toContain("rotate_v22_report_share");
    expect(migration).toMatch(/revoke execute[\s\S]+from anon, authenticated/i);
    expect(migration).not.toMatch(/\b(delete|truncate|drop)\b/i);
  });

  it("parses CLI JSON without retaining status chatter", () => {
    expect(parseSupabaseJson("Initialising login role...\n{\"migrations\":[]}"))
      .toEqual({ migrations: [] });
  });

  it("redacts configured values and stores only bounded command evidence", () => {
    const sentinel = "release-validation-secret";
    const raw = `Bearer abcdefghijklmnop password=${sentinel}`;
    const environment = { ...process.env, SUPABASE_DB_PASSWORD: sentinel };
    const safe = redactSensitiveText(raw, environment);
    expect(safe).not.toContain(sentinel);
    expect(safe).toContain("[REDACTED]");
    expect(commandEvidence(raw, environment)).toEqual(expect.objectContaining({
      passed: true,
      bytes: expect.any(Number),
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(commandEvidence(raw, environment)).not.toHaveProperty("output");
    expect(() => boundedJson({ value: "x".repeat(100) }, 10)).toThrow("VALIDATION_OUTPUT_TOO_LARGE");
  });

  it("keeps remote validation manual and requires typed project confirmation", async () => {
    const runner = await readFile(path.join(root, "scripts/verify-v22-data-migration.mjs"), "utf8");
    const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    expect(runner).toContain("REMOTE_PROJECT_CONFIRMATION_REQUIRED");
    expect(runner).toContain('argument("confirm-project")');
    expect(packageJson.scripts["migration:v22:remote"]).not.toContain(TARGET_PROJECT.ref);
    expect(packageJson.scripts.quality).not.toContain("migration:v22:remote");
  });
});
