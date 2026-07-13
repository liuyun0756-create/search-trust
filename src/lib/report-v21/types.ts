export type LayerKey =
  | "foundation"
  | "entity_presence"
  | "entity_consistency"
  | "specificity"
  | "real_world_connection"
  | "accountability"
  | "page_unique_value"
  | "algorithm_fit";

export type LayerStatus = "good" | "medium" | "weak" | "not_checked";
export type GBPStatusValue = "checked" | "not_checked" | "not_found" | "error";
export type GBPSource = "user_provided" | "system_discovered" | "not_available";
export type OverallStatusLevel = "weak" | "medium_weak" | "medium" | "strong" | "high";
export type RankingPotentialLevel = "low" | "competitive" | "improvable" | "strong";
export type RiskLevelValue = "low" | "medium" | "medium_high" | "high";
export type EvidenceSourceType =
  | "page"
  | "gbp"
  | "schema"
  | "contact_page"
  | "about_page"
  | "review"
  | "site_internal"
  | "not_available";
export type ComparisonResult = "match" | "missing" | "mismatch" | "partial" | "not_checked";
export type Confidence = "high" | "medium" | "low";
export type ActionPriority = "high" | "medium" | "low";
export type EffortLevel = "small" | "medium" | "large";

export interface GBPStatus {
  status: GBPStatusValue;
  source?: GBPSource;
  gbp_url?: string | null;
  reason?: string | null;
}

export interface DataCoverage {
  page_content_checked: boolean;
  gbp_checked: boolean;
  schema_checked: boolean;
  contact_page_checked: boolean;
  about_page_checked: boolean;
  reviews_checked: boolean;
  internal_pages_checked: boolean;
  competitor_pages_checked: boolean;
  limitations: string[];
}

export interface OverallStatus {
  label: string;
  level: OverallStatusLevel;
  explanation: string;
}

export interface RankingPotential {
  label: string;
  level: RankingPotentialLevel;
  explanation: string;
}

export interface RiskLevel {
  label: string;
  level: RiskLevelValue;
  explanation: string;
}

export interface EvidenceItem {
  id: string;
  source_type: EvidenceSourceType;
  source_label: string;
  source_url?: string | null;
  page_section?: string | null;
  extracted_text?: string | null;
  normalized_value?: string | null;
  expected_value?: string | null;
  comparison_result: ComparisonResult;
  confidence: Confidence;
  explanation: string;
}

export interface ActionItem {
  id: string;
  priority: ActionPriority;
  task_title: string;
  affected_layer: LayerKey;
  related_rule_ids: number[];
  where_to_add: string[];
  what_to_add: string[];
  example_copy: string[];
  implementation_notes: string[];
  completion_signals: string[];
  expected_effect: string;
  effort_level: EffortLevel;
}

export interface PrimaryBlockingLayer {
  layer_key: LayerKey;
  layer_name: string;
  reason: string;
  evidence_items: EvidenceItem[];
}

export interface PageLevel {
  label: string;
  what_it_looks_like: string;
  strengths: string[];
  missing_elements: string[];
}

export interface LayerFinding {
  layer_id: number;
  layer_key: LayerKey;
  layer_name: string;
  layer_label: string;
  status: LayerStatus;
  checked_rule_ids: number[];
  triggered_rule_ids: number[];
  summary: string;
  explanation: string;
  evidence_items: EvidenceItem[];
  suggested_fixes: string[];
  action_items: ActionItem[];
}

export interface KeyIssue {
  id: string;
  issue_title: string;
  affected_layer: LayerKey;
  related_rule_ids: number[];
  severity: ActionPriority;
  evidence_items: EvidenceItem[];
  explanation: string;
  why_it_matters: string;
  recommended_actions: ActionItem[];
}

export interface RoadmapPhase {
  id: string;
  phase_title: string;
  sequence: number;
  goal: string;
  entry_condition: string;
  action_items: ActionItem[];
  expected_outcomes: string[];
}

export interface OptimizationPath {
  must_execute_now: ActionItem[];
  defer_until_later: ActionItem[];
  do_not_prioritize_yet: ActionItem[];
  roadmap: RoadmapPhase[];
  fix_order_warning: string;
  completion_signals: string[];
}

export interface ClientSummary {
  title: string;
  plain_language_summary: string;
  why_it_matters: string;
  first_priority: string;
  not_first_priority: string;
  expected_change: string;
}

export interface AgencyBranding {
  enabled?: boolean;
  agency_name?: string;
  agency_logo_url?: string;
  client_name?: string;
  footer_note?: string;
}

export interface ReportV21 {
  schema_version: "2.1";
  report_id: string;
  analyzed_url: string;
  page_type: string;
  generated_at: string;
  gbp_status: GBPStatus;
  data_coverage: DataCoverage;
  overall_status: OverallStatus;
  ranking_potential: RankingPotential;
  risk_level: RiskLevel;
  primary_blocking_layer: PrimaryBlockingLayer;
  page_level: PageLevel;
  layers: LayerFinding[];
  key_issues: KeyIssue[];
  optimization_path: OptimizationPath;
  client_summary: ClientSummary;
  agency_branding?: AgencyBranding;
}

export type NormalizedReportSource = "native" | "legacy_adapted" | "fallback";

export interface NormalizedReportV21Result {
  reportV21: ReportV21;
  source: NormalizedReportSource;
  valid: boolean;
  errors: string[];
  warnings: string[];
}
