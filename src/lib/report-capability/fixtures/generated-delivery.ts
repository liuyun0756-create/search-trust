/** Fixed QA fixtures only; never imported by production report routes. */
import { readFileSync } from "node:fs";
import { validateCapabilityReport } from "../validate";
import { initialCapabilityRevision } from "../revision";
import { buildApprovedCapabilityDelivery, type SavedCapabilityRevision } from "../delivery";

export function generatedDelivery(name: string) {
  const checked = validateCapabilityReport(JSON.parse(readFileSync(new URL(`./generated/${name}`, import.meta.url), "utf8")));
  if (!checked.ok) throw new Error("Invalid generated fixture");
  const report = checked.report, content = initialCapabilityRevision(report);
  content.status = "approved";
  const saved: SavedCapabilityRevision = { id: "00000000-0000-0000-0000-000000009999", report_id: report.id,
    user_id: report.input_manifest.user_id, case_id: report.input_manifest.case_id,
    revision: 1, status: "approved", approved_at: "2026-09-01T12:00:00Z", content };
  return { report, saved, delivery: buildApprovedCapabilityDelivery(report, saved) };
}
