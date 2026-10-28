import type {PageCheckContext, PageCheckSelection, PageCheckView} from "./types";

export const owner = "e1000000-0000-4000-8000-000000000001";
export const target = {caseId: "e1000000-0000-4000-8000-000000000002", reportId: "e1000000-0000-4000-8000-000000000003", deliveryRevisionId: "e1000000-0000-4000-8000-000000000004"};
export const checkId = "e1000000-0000-4000-8000-000000000005";
export const pageContext: PageCheckContext = {
  schema_version: "v22_page_check_context_v1", case_id: target.caseId, report_id: target.reportId, delivery_revision_id: target.deliveryRevisionId,
  delivery_revision: 1, implementation: {id: "e1000000-0000-4000-8000-000000000006", revision: 1, checksum: `sha256:${"1".repeat(64)}`},
  actions: [{id: "action-1", title: "Clarify the repair service"}, {id: "action-2", title: "Clarify the contact step"}],
  eligibility: "eligible", site_url: "https://service.example.com/", history: [],
  limits: {used: 0, active: false, server_time: "2026-10-26T01:00:00Z", next_request_at: "2026-10-26T01:00:00Z", reason: null},
};
export const pageSelection: PageCheckSelection = {implementation: pageContext.implementation!, action_id: "action-1",
  target_url: `${pageContext.site_url}repair`, conditions: [{id: "condition-1", kind: "text_present", value: "Repair service"}]};
export function pageView(id = checkId, status: PageCheckView["status"] = "queued", selection = pageSelection): PageCheckView {
  return {schema_version: "v22_page_check_view_v1", id, case_id: target.caseId, report_id: target.reportId,
    delivery_revision_id: target.deliveryRevisionId, delivery_revision: 1, site_url: pageContext.site_url,
    selection: structuredClone(selection), created_at: "2026-10-26T01:00:00Z", status,
    completed_at: ["completed", "failed"].includes(status) ? "2026-10-26T01:00:30Z" : null,
    error_code: status === "failed" ? "PAGE_CHECK_INTERRUPTED" : null,
    observation: status === "completed" ? {status: "checked", failure: null, observed_at: "2026-10-26T01:00:29Z",
      results: selection.conditions.map(c => ({condition_id: c.id, state: "observed"})) as NonNullable<PageCheckView["observation"]>["results"],
      limitation: "static_response_only_rendering_functionality_and_identity_not_verified"} : null};
}
