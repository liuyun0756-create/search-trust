// Controlled projection fixtures. Never imported by application components.
import fixture from "./contracts/fixture.json";
import {record, target} from "../comparison-checks/test-fixture";
import {ga4Id, ga4View} from "../ga4-comparison-collections/test-fixture";
import {canonicalDigest} from "../verified-analysis-v22/digest";
import type {Ga4ReviewInput, Ga4ReviewRecord, Ga4ReviewView, SeoChecks} from "./types";
export const job = ga4View(ga4Id, "succeeded");
export const emptyChecks = (): SeoChecks => ({date_coverage: {status: "not_checked", note: ""}, event_history: {status: "not_checked", note: ""}, measurement_setup: {status: "not_checked", note: ""}});
export function reviewView(): Ga4ReviewView {
  const view = structuredClone(fixture) as unknown as Ga4ReviewView;
  Object.assign(view, {case_id: target.caseId, report_id: target.reportId, delivery_revision_id: target.deliveryRevisionId});
  Object.assign(view.audit, {collection_id: ga4Id, windows: job.windows, scope: job.scope,
    observation_checksum: job.qualification!.observation_checksum, observed_at: job.completed_at,
    configuration_before_at: job.completed_at, configuration_after_at: job.completed_at});
  return view;
}
export const input = (): Ga4ReviewInput => ({request_id: "e0000000-0000-4000-8000-000000000001", expected_revision: 0,
  observation_checksum: job.qualification!.observation_checksum, checks: emptyChecks()});
export function reviewRecord(value = input()): Ga4ReviewRecord {
  const content = {schema_version: "v22_ga4_seo_review_v1" as const, source: "seo_recorded" as const,
    user_id: record.user_id, case_id: target.caseId, report_id: target.reportId, delivery_revision_id: target.deliveryRevisionId,
    collection_id: ga4Id, request_id: value.request_id, revision: value.expected_revision+1,
    recorded_at: "2026-12-16T10:00:00Z", observation_checksum: value.observation_checksum, checks: value.checks};
  return {...content, checksum: canonicalDigest(content)};
}
