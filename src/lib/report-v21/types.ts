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
export type AuditStatus = "checked" | "partial" | "not_checked" | "error" | "not_applicable";
export type AuditComparisonStatus =
  | "match"
  | "missing"
  | "mismatch"
  | "partial"
  | "not_checked"
  | "not_applicable"
  | "error";

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
  citations_checked?: boolean;
  geo_grid_checked?: boolean;
  limitations: string[];
}

export interface AuditScopeItem {
  key: string;
  label: string;
  status: AuditStatus;
  detail: string;
}

export interface BusinessPresenceSummary {
  assessed_items: number;
  matched_items: number;
  issue_items: number;
  not_checked_items: number;
}

export interface PresenceComparisonItem {
  key: string;
  evidence_id: string;
  label: string;
  status: AuditComparisonStatus;
  page_value?: string | null;
  gbp_value?: string | null;
  page_source?: string | null;
  gbp_source?: string | null;
  explanation: string;
  related_layer?: LayerKey | null;
  included_in_score: boolean;
}

export interface ProfileActivity {
  status: AuditStatus;
  categories: string[];
  category_source: "observed" | "authoritative" | "not_available";
  photo_count?: number | null;
  latest_photo_date?: string | null;
  photo_status: AuditStatus;
  post_count?: number | null;
  latest_post_date?: string | null;
  post_status: AuditStatus;
  limitations: string[];
}

export interface ReviewSampleItem {
  author?: string | null;
  rating?: number | null;
  date?: string | null;
  text?: string | null;
  owner_reply?: string | null;
}

export interface ReviewAudit {
  status: AuditStatus;
  total_reviews?: number | null;
  sample_size: number;
  sample_limit: number;
  latest_review_date?: string | null;
  rating_distribution: Record<string, number>;
  owner_reply_count: number;
  owner_reply_rate?: number | null;
  unanswered_count?: number;
  low_rating_count?: number;
  low_rating_unanswered_count?: number;
  detailed_positive_count?: number;
  reviews: ReviewSampleItem[];
  limitations: string[];
}

export type BusinessPresenceProposalStatus = "clear" | "needs_attention" | "limited";
export type BusinessPresenceArea = "identity_alignment" | "profile_activity" | "review_operations";

export interface BusinessPresenceProposalSummary {
  headline: string;
  summary: string;
  identity_issue_count: number;
  profile_opportunity_count: number;
  review_action_count: number;
}

export interface BusinessPresenceProposalAction {
  id: string;
  priority: ActionPriority;
  business_area: BusinessPresenceArea;
  title: string;
  rationale: string;
  recommended_scope: string[];
  evidence_keys: string[];
}

export interface BusinessPresenceAudit {
  audit_scope: AuditScopeItem[];
  summary: BusinessPresenceSummary;
  gbp_page_alignment: PresenceComparisonItem[];
  profile_activity: ProfileActivity;
  review_audit: ReviewAudit;
  citations: {
    status: AuditStatus;
    reason: string;
  };
  proposal_status?: BusinessPresenceProposalStatus;
  proposal_summary?: BusinessPresenceProposalSummary;
  proposal_actions?: BusinessPresenceProposalAction[];
}

export type PdfVariant = "client" | "full";

export interface GBPProfileSnapshot {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  categories?: string[];
  hours?: string | null;
  rating?: string | null;
  review_count?: string | null;
  service_areas?: string[];
}

export interface GBPAlignmentContractRow {
  field_key: string;
  field_label: string;
  page_value?: string | null;
  gbp_value?: string | null;
  status: ComparisonResult;
  impact: string;
  suggested_fix: string;
  related_layer_keys: LayerKey[];
}

export interface SchemaSummary {
  checked: boolean;
  source_url?: string | null;
  types: string[];
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
  addressed_findings?: string[];
  required_changes?: string[];
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
  current_assessment?: string;
  existing_foundation?: string;
  main_limitation?: string;
  likely_search_outcome?: string;
  competitive_interpretation?: string;
}

export interface LayerFinding {
  layer_id: number;
  layer_key: LayerKey;
  layer_name: string;
  layer_label: string;
  status: LayerStatus;
  presentation_mode?: "healthy" | "healthy_with_opportunities" | "attention";
  checked_rule_ids: number[];
  triggered_rule_ids: number[];
  triggered_findings?: string[];
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
  judgement?: string;
  explanation: string;
  why_it_matters: string;
  impacts?: string[];
  suggestions?: string[];
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

export type ClientDecisionPriority = "immediate" | "high" | "planned" | "monitor";
export type ClientDecisionStage = "current" | "later" | "not_now";

export interface ClientDecisionWorkPhase {
  stage: ClientDecisionStage;
  phase_number: 1 | 2 | 3 | 4;
  label: string;
  layer_keys: LayerKey[];
  layer_labels: string[];
  task_titles: string[];
  summary: string;
}

export interface ClientDecisionContext {
  priority_level: ClientDecisionPriority;
  priority_label: string;
  why_act_now: string;
  issue_count: number;
  affected_layer_count: number;
  work_phase_count: number;
  score_interpretation: string;
  work_sequence: ClientDecisionWorkPhase[];
}

export interface ClientSummary {
  title: string;
  plain_language_summary: string;
  why_it_matters: string;
  first_priority: string;
  not_first_priority: string;
  expected_change: string;
  decision_context?: ClientDecisionContext | null;
}

export interface AgencyBranding {
  enabled?: boolean;
  agency_name?: string;
  agency_logo_data?: string;
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
  gbp_profile?: GBPProfileSnapshot | null;
  gbp_alignment?: GBPAlignmentContractRow[];
  schema_summary?: SchemaSummary | null;
  data_coverage: DataCoverage;
  business_presence_audit?: BusinessPresenceAudit | null;
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
