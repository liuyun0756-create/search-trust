import type { WorkspaceView } from "../review-workspace/types";
export type Identity = { ownerId: string; caseId: string; reportId: string };
export type Disposition = "continue" | "adjust" | "observe" | "defer" | "new";
export type Decision = {
  source: "seo_recorded";
  action_id: string;
  disposition: Disposition;
  reason: string;
  references: string[];
  target: string | null;
  work: string | null;
  completion_statement: string | null;
  reconsider_when: string | null;
};
export type SaveDecision = {
  id: string;
  review_id: string;
  previous_id: string | null;
  previous_checksum: string | null;
  decisions: Decision[];
};
export type Revision = SaveDecision & {
  schema_version: "v22_review_decision_revision_v1";
  user_id: string;
  case_id: string;
  report_id: string;
  evidence_checksum: string;
  bundle_checksum: string;
  revision: number;
  recorded_at: string;
  request_checksum: string;
  checksum: string;
};
export type HistoryItem = Pick<
  Revision,
  "id" | "revision" | "previous_id" | "recorded_at" | "checksum"
> & { decision_count: number };
export type History = {
  review_id: string;
  report_id: string;
  items: HistoryItem[];
  next_cursor: number | null;
};
export type ApprovedWork = {
  action_id: string;
  title: string;
  target: string;
  steps: string[];
  completion: string[];
  review: string;
};
export type Reference = {
  id: string;
  action_id: string;
  kind: "implementation" | "page" | "gsc" | "ga4";
  label: string;
  detail: string;
};
export type Context = {
  schema_version: "v22_review_decision_context_v1";
  evidence_checksum: string;
  bundle_checksum: string;
  evidence: WorkspaceView;
  approved: ApprovedWork[];
  references: Reference[];
};
export type PublicCommand =
  | { operation: "context"; review_id: string }
  | { operation: "history"; review_id: string; cursor?: number | null }
  | { operation: "read"; review_id: string; decision_id: string }
  | { operation: "save"; request: SaveDecision };
export type Command = PublicCommand & {
  user_id: string;
  case_id: string;
  report_id: string;
};
export type Result = Context | History | Revision;
