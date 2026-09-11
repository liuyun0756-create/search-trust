import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "src");
const SELF = "src/lib/ci-v22/no-v21-runtime.test.ts";
const ALLOWED_HISTORY = new Set([
  "src/lib/database/v22Migration.test.ts",
  "src/types/database.ts",
]);

const RETIRED_PATHS = [
  "src/lib/" + "report-v21",
  "src/components/report/" + "v21",
  "src/components/report/" + "sampleReportV21.ts",
  "src/components/report/" + "sampleReportV21Data.json",
  "src/app/" + "test-report",
  "src/app/api/" + "generate-report",
  "src/app/api/" + "report-status",
  "src/app/api/" + "report-meta",
  "src/app/api/" + "checkout/route.ts",
  "src/app/api/" + "checkout/confirm/route.ts",
  "src/app/api/" + "send-report/route.ts",
  "src/app/api/reports/route.ts",
  "src/app/api/reports/[id]/route.ts",
  "src/app/" + "sample-case",
  "src/components/common/" + "AuditFormModal.tsx",
  "src/components/common/" + "PaymentModal.tsx",
  "src/components/report/" + "ReportContent.tsx",
  "src/components/report/pdf/" + "ReportPDFDocument.tsx",
  "src/components/report/" + "SampleReportContent.tsx",
  "src/lib/" + "submit-audit.ts",
];

const RETIRED_REFERENCES = [
  "report-" + "v21",
  "report_" + "v2_1",
  "Report" + "V21",
  "sampleReport" + "V21",
  "/api/" + "generate-report",
  "/api/" + "report-status",
  "/api/" + "report-meta",
  "/api/" + "checkout",
  "/api/" + "send-report",
  "/api/v1/" + "analyze",
  "/api/v1/" + "task",
];

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory);
  const files = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry);
    return (await stat(absolute)).isDirectory() ? filesUnder(absolute) : [absolute];
  }));
  return files.flat();
}

describe("V2.2 frontend runtime boundary", () => {
  it("contains no executable V2.1 report paths or references", async () => {
    const existingRetiredPaths: string[] = [];
    for (const retiredPath of RETIRED_PATHS) {
      try {
        const absolute = path.join(ROOT, retiredPath);
        const retiredStat = await stat(absolute);
        if (!retiredStat.isDirectory() || (await filesUnder(absolute)).length > 0) {
          existingRetiredPaths.push(retiredPath);
        }
      } catch {
        // Missing is the required state.
      }
    }

    const references: string[] = [];
    for (const absolute of await filesUnder(SOURCE_ROOT)) {
      const relative = path.relative(ROOT, absolute).split(path.sep).join("/");
      if (relative === SELF || ALLOWED_HISTORY.has(relative) || !/\.(?:ts|tsx|js|jsx|json)$/.test(relative)) continue;
      const source = await readFile(absolute, "utf8");
      for (const retiredReference of RETIRED_REFERENCES) {
        if (source.includes(retiredReference)) references.push(`${relative}: ${retiredReference}`);
      }
    }

    expect({ existingRetiredPaths, references }).toEqual({
      existingRetiredPaths: [],
      references: [],
    });
  });
});
