/** Offline only. No env files, customer input, provider calls or billing. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { candidateCopy, projectSiteCandidate, type CandidateId } from "../src/lib/site-report-candidates/project";
import { validateCapabilityReport } from "../src/lib/report-capability/validate";

const root = path.resolve(import.meta.dirname, "..");
const backend = path.resolve(root, "../SearchTrust-RD");
const args = process.argv.slice(2);
if (args.some(arg => arg !== "--check")) throw new Error("Only --check is supported");
const source = JSON.parse(execFileSync(path.join(backend, ".venv/bin/python"),
  [path.join(backend, "scripts/export_v22_site_candidates.py")], {
    cwd: backend, encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
    env: { PATH: process.env.PATH, NODE_ENV: "test", PYTHONDONTWRITEBYTECODE: "1" },
  }));
if (source.purpose !== "release_candidate_synthetic_sources_v1") throw new Error("Candidate provenance required");
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const ids: CandidateId[] = ["prospect", "verified", "diagnosis"];
const reports = ids.map(id => ({ id, ...candidateCopy[id], document: projectSiteCandidate(source.reports[id]) }));
const data = {
  purpose: source.purpose,
  notice: "Release review · Actual report generator, illustrative sources. Not customer results or a live product release.",
  reports,
};
const manifest = {
  version: 1, purpose: source.purpose, displaySha256: hash(data),
  reports: ids.map((id, i) => {
    const checked = validateCapabilityReport(source.reports[id]);
    if (!checked.ok) throw new Error("Invalid report");
    return { id, schemaVersion: checked.report.schema_version, ruleset: checked.report.input_manifest.ruleset_version,
      sourceSha256: hash(source.reports[id]), displaySha256: hash(reports[i].document),
      actions: reports[i].document.actions.length, findings: reports[i].document.findings.length,
      evidence: reports[i].document.evidence.length };
  }),
};
const dir = path.join(root, "src/lib/site-report-candidates/generated");
if (!args.includes("--check")) mkdirSync(dir, { recursive: true });
for (const [name, value] of Object.entries({ "reports.json": data, "manifest.json": manifest })) {
  const file = path.join(dir, name), content = JSON.stringify(value, null, 2) + "\n";
  if (args.includes("--check")) {
    if (readFileSync(file, "utf8") !== content) throw new Error(`Candidate drift: ${name}`);
  } else writeFileSync(file, content);
}
console.log(JSON.stringify({ ok: true, check: args.includes("--check"), reports: manifest.reports.map(r => ({ id: r.id, actions: r.actions, evidence: r.evidence })) }));
