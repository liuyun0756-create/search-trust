// Synthetic, exported backend fixture. Not imported by application code.
import fixture from "./contracts/fixture.json";
import type {Ga4SessionReading} from "./types";
import {ga4View} from "../ga4-comparison-collections/test-fixture";
export const reading = () => structuredClone(fixture) as Ga4SessionReading;
export const target = {caseId: fixture.case_id, reportId: fixture.report_id, deliveryRevisionId: fixture.delivery_revision_id};
export function readingJob() {
  const r = reading(), j = ga4View(r.collection_id, "succeeded");
  return {...j, case_id: r.case_id, report_id: r.report_id, delivery_revision_id: r.delivery_revision_id,
    selection: {...j.selection, implementation: r.implementation, action_id: r.action_id, days: r.windows.days, landing_path: r.scope.landing_path},
    scope: r.scope, windows: r.windows, completed_at: r.completed_at,
    qualification: {...j.qualification!, observation_checksum: r.observation_checksum}};
}
