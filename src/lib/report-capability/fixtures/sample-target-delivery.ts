/** In-memory sampling fixture; never changes saved reports or evidence. */
import { generatedDelivery } from "./generated-delivery";
import { readFileSync } from "node:fs";
import { validateCapabilityReport } from "../validate";
import { initialCapabilityRevision } from "../revision";
import { buildApprovedCapabilityDelivery, type SavedCapabilityRevision } from "../delivery";

export const sampleTarget = (query: string, device = "mobile") =>
  `${query} · organic · 36.774001,-119.68942 · en · ${device}`;

export const targetQueries = ["Action query", "Finding query", "Material query", "Original query", "Scope query", "Step query"];
export const ordinaryTarget = "https://example.com/service";
export const unmatchedTarget = "Homepage · 12, Main St · en · mobile";

export function sampleTargetDelivery() {
  const { delivery } = generatedDelivery("service-first.json");
  const action = delivery.document.actions[0];
  action.target = [sampleTarget(targetQueries[0]), sampleTarget(targetQueries[0], "desktop"), ordinaryTarget, unmatchedTarget].join("\n");
  delivery.document.findings[0].target = sampleTarget(targetQueries[1]);
  action.materials[0].target = sampleTarget(targetQueries[2]);
  if (!action.whyNow) throw new Error("Fixture requires a priority rationale");
  action.whyNow.deliveryChanged = true;
  action.whyNow.systemTarget = sampleTarget(targetQueries[3]);
  action.whyNow.comparisonScopes = [sampleTarget(targetQueries[4]), sampleTarget(targetQueries[4], "desktop")];
  // Nova v5 also repeats the raw target inside its first execution step.
  action.steps[0] = `Target: ${sampleTarget(targetQueries[5])}\n${sampleTarget(targetQueries[5], "desktop")}`;
  return delivery;
}

/** Optional local acceptance input; no private report is copied into the repository. */
export function novaSampleDelivery() {
  const raw = JSON.parse(readFileSync(process.env.P0_01_NOVA_REPORT_PATH!, "utf8"));
  const checked = validateCapabilityReport(raw.payload ?? raw);
  if (!checked.ok) throw new Error("Invalid Nova acceptance report");
  const report = checked.report;
  const content = initialCapabilityRevision(report);
  // This approval exists only in memory for renderer testing.
  content.status = "approved";
  const saved: SavedCapabilityRevision = {
    id: "00000000-0000-0000-0000-000000009999", report_id: report.id,
    user_id: report.input_manifest.user_id, case_id: report.input_manifest.case_id,
    revision: 1, status: "approved", approved_at: "2026-11-02T00:00:00Z", content,
  };
  return buildApprovedCapabilityDelivery(report, saved);
}
