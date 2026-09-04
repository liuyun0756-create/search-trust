import type {
  EvidenceItem,
  Finding,
  FirstPartyPerformance,
  LayerAssessment,
  Limitation,
  SearchTrustReportV2_2,
  SiteInventorySummary,
  SourceCoverage,
  TopAction,
  VersionDiff,
} from "./generated/types";

export type ReportV22Mode = "advisor" | "client";

export const REPORT_V22_LAYER_LABELS = {
  foundation: "Foundation",
  entity_presence: "Entity presence",
  entity_consistency: "Entity consistency",
  specificity: "Specificity",
  real_world_connection: "Real-world connection",
  accountability: "Accountability",
  page_unique_value: "Page unique value",
  algorithm_fit: "Algorithm fit",
} as const;

export const REPORT_V22_PERIOD_LABELS = {
  days_1_30: "Days 1–30",
  days_31_60: "Days 31–60",
  days_61_90: "Days 61–90",
} as const;

export interface ReportV22HeaderViewModel {
  businessName: string;
  caseId: string;
  generatedAt: string;
  location: string;
  primaryService: string;
  reportId: string;
  reportType: "prospect" | "verified_execution";
  siteUrl: string;
  versionNumber: number;
}

export interface ReportV22CompetitorViewModel {
  analyzedPageCount: number;
  bestPosition: number;
  businessName: string;
  gaps: string[];
  publicGbpUrl: string | null;
  queryAppearanceCount: number;
  strengths: string[];
  websiteUrl: string;
}

export interface ClientActionViewModel {
  actionId: string;
  clientFacingExplanation: string;
  effort: TopAction["effort_bucket"];
  requiredClientAssets: string[];
  reviewDate: string;
  sequence: number;
  whyNow: string;
}

export interface ReportV22RoadmapPhaseViewModel {
  actionIds: string[];
  actionLabels: string[];
  exitCriteria: string[];
  label: string;
  objective: string;
  period: "days_1_30" | "days_31_60" | "days_61_90";
}

export interface PublicLimitationViewModel {
  category: Limitation["category"];
  description: string;
  severity: Limitation["severity"];
}

interface SharedReportV22ViewModel {
  clientSummary: {
    coreProblem: string;
    headline: string;
    nextReviewDate: string;
    opportunity: string;
    requiredClientAssets: string[];
  };
  competitorAnalysis: {
    comparisonSummary: string;
    competitors: ReportV22CompetitorViewModel[];
    limitations: string[];
  };
  header: ReportV22HeaderViewModel;
  limitations: PublicLimitationViewModel[];
  roadmap: ReportV22RoadmapPhaseViewModel[];
}

export interface ClientReportV22ViewModel extends SharedReportV22ViewModel {
  actions: ClientActionViewModel[];
  mode: "client";
}

export interface AdvisorActionViewModel extends ClientActionViewModel {
  dataSources: TopAction["data_sources"];
  definitionOfDone: string[];
  dependencies: string[];
  exactTargets: string[];
  findingIds: string[];
  implementationSteps: TopAction["implementation_steps"];
  ownerSuggestion: string;
  specification: TopAction["specification"];
  validationMetrics: TopAction["validation_metrics"];
}

export interface AdvisorLayerViewModel extends LayerAssessment {
  label: string;
}

export interface AdvisorReportV22ViewModel extends SharedReportV22ViewModel {
  actions: AdvisorActionViewModel[];
  dataCoverage: {
    fullEvidenceCoverage: boolean;
    limitations: string[];
    sources: SourceCoverage[];
  };
  evidence: EvidenceItem[];
  executiveDecision: SearchTrustReportV2_2["executive_decision"];
  findings: Finding[];
  firstPartyPerformance: FirstPartyPerformance;
  layers: AdvisorLayerViewModel[];
  marketSnapshot: SearchTrustReportV2_2["market_snapshot"];
  mode: "advisor";
  reportMetadata: {
    copyModelVersion: string;
    rulesetVersion: string;
    schemaVersion: string;
  };
  siteInventory: SiteInventorySummary;
  versionDiff: VersionDiff;
}

export type ReportV22ViewModel = ClientReportV22ViewModel | AdvisorReportV22ViewModel;

function sharedViewModel(report: SearchTrustReportV2_2): SharedReportV22ViewModel {
  const actionLabels = new Map(
    report.top_actions.map((action) => [action.action_id, action.client_facing_explanation]),
  );

  return {
    header: {
      businessName: report.identity.business.business_name,
      caseId: report.identity.case_id,
      generatedAt: report.report_version.generated_at,
      location: report.case_context.target_market.display_name,
      primaryService: report.case_context.primary_service,
      reportId: report.report_version.report_id,
      reportType: report.report_version.report_type,
      siteUrl: report.identity.business.site_url,
      versionNumber: report.report_version.version_number,
    },
    clientSummary: {
      coreProblem: report.client_summary.core_problem,
      headline: report.client_summary.headline,
      nextReviewDate: report.client_summary.next_review_date,
      opportunity: report.client_summary.opportunity,
      requiredClientAssets: [...(report.client_summary.required_client_assets ?? [])],
    },
    competitorAnalysis: {
      comparisonSummary: report.competitor_analysis.comparison_summary,
      competitors: report.competitor_analysis.competitors.map((competitor) => ({
        analyzedPageCount: competitor.analyzed_page_count,
        bestPosition: competitor.best_position,
        businessName: competitor.business_name,
        gaps: [...(competitor.gaps ?? [])],
        publicGbpUrl: competitor.public_gbp_url ?? null,
        queryAppearanceCount: competitor.query_appearance_count,
        strengths: [...(competitor.strengths ?? [])],
        websiteUrl: competitor.website_url,
      })),
      limitations: [...(report.competitor_analysis.limitations ?? [])],
    },
    roadmap: report.roadmap_30_60_90.phases.map((phase) => ({
      actionIds: [...phase.action_ids],
      actionLabels: phase.action_ids.map((actionId) => actionLabels.get(actionId) ?? actionId),
      exitCriteria: [...phase.exit_criteria],
      label: REPORT_V22_PERIOD_LABELS[phase.period],
      objective: phase.objective,
      period: phase.period,
    })),
    limitations: (report.limitations ?? []).map((limitation) => ({
      category: limitation.category,
      description: limitation.description,
      severity: limitation.severity,
    })),
  };
}

function clientAction(action: TopAction): ClientActionViewModel {
  return {
    actionId: action.action_id,
    clientFacingExplanation: action.client_facing_explanation,
    effort: action.effort_bucket,
    requiredClientAssets: [...(action.required_client_assets ?? [])],
    reviewDate: action.review_date,
    sequence: action.sequence,
    whyNow: action.why_now,
  };
}

export function buildReportV22ViewModel(
  report: SearchTrustReportV2_2,
  mode: "client",
): ClientReportV22ViewModel;
export function buildReportV22ViewModel(
  report: SearchTrustReportV2_2,
  mode: "advisor",
): AdvisorReportV22ViewModel;
export function buildReportV22ViewModel(
  report: SearchTrustReportV2_2,
  mode: ReportV22Mode,
): ReportV22ViewModel {
  const shared = sharedViewModel(report);

  if (mode === "client") {
    return {
      ...shared,
      actions: report.top_actions.map(clientAction),
      mode,
    };
  }

  return {
    ...shared,
    actions: report.top_actions.map((action) => ({
      ...clientAction(action),
      dataSources: [...action.data_sources] as TopAction["data_sources"],
      definitionOfDone: [...action.definition_of_done],
      dependencies: [...(action.dependencies ?? [])],
      exactTargets: [...action.exact_targets],
      findingIds: [...action.finding_ids],
      implementationSteps: action.implementation_steps.map((step) => ({ ...step })) as TopAction["implementation_steps"],
      ownerSuggestion: action.owner_suggestion,
      specification: {
        content_requirements: [...(action.specification.content_requirements ?? [])],
        gbp_requirements: [...(action.specification.gbp_requirements ?? [])],
        technical_requirements: [...(action.specification.technical_requirements ?? [])],
      },
      validationMetrics: action.validation_metrics.map((metric) => ({ ...metric })) as TopAction["validation_metrics"],
    })),
    dataCoverage: {
      fullEvidenceCoverage: report.data_coverage.full_evidence_coverage,
      limitations: [...(report.data_coverage.limitations ?? [])],
      sources: report.data_coverage.sources.map((source) => ({ ...source })),
    },
    evidence: report.evidence_index.map((item) => ({
      ...item,
      limitations: [...(item.limitations ?? [])],
      source_locator: { ...item.source_locator },
    })) as SearchTrustReportV2_2["evidence_index"],
    executiveDecision: { ...report.executive_decision },
    findings: report.findings.map((finding) => ({
      ...finding,
      evidence_ids: [...finding.evidence_ids],
    })) as SearchTrustReportV2_2["findings"],
    firstPartyPerformance: report.first_party_performance,
    layers: report.eight_layers.map((layer) => ({
      ...layer,
      label: REPORT_V22_LAYER_LABELS[layer.layer_key],
    })),
    marketSnapshot: report.market_snapshot,
    mode,
    reportMetadata: {
      copyModelVersion: report.report_version.copy_model_version,
      rulesetVersion: report.report_version.ruleset_version,
      schemaVersion: report.report_version.schema_version,
    },
    siteInventory: report.site_inventory_summary,
    versionDiff: report.version_diff,
  };
}
