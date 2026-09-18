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

interface ReportHeaderBase {
  businessName: string;
  generatedAt: string;
  location: string;
  primaryService: string;
  reportType: "prospect" | "verified_execution";
  versionNumber: number;
}

export interface ReportV22HeaderViewModel extends ReportHeaderBase {
  caseId: string;
  reportId: string;
  siteUrl: string;
}

export interface ClientEvidenceViewModel {
  decisionRelevance: string;
  observation: string;
  sourceLabel: string;
  subjectLabel: string | null;
}

export interface ClientActionViewModel {
  effort: TopAction["effort_bucket"];
  expectedResult: string;
  requiredClientAssets: string[];
  reviewDate: string;
  sequence: number;
  title: string;
  whyNow: string;
}

export interface ClientRoadmapPhaseViewModel {
  expectedResult: string;
  label: string;
  objective: string;
  period: "days_1_30" | "days_31_60" | "days_61_90";
}

export interface ClientReportV22ViewModel {
  actions: ClientActionViewModel[];
  clientInputs: string[];
  coverageAppendix: {
    boundarySummary: string;
    checkedSources: string[];
    unavailableSources: string[];
  };
  decision: {
    businessImpact: string;
    headline: string;
    opportunity: string;
  };
  evidenceCards: ClientEvidenceViewModel[];
  header: ReportHeaderBase;
  mode: "client";
  nextReviewDate: string;
  roadmap: ClientRoadmapPhaseViewModel[];
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

export interface AdvisorActionViewModel {
  actionId: string;
  clientFacingExplanation: string;
  dataSources: TopAction["data_sources"];
  definitionOfDone: string[];
  dependencies: string[];
  effort: TopAction["effort_bucket"];
  exactTargets: string[];
  findingIds: string[];
  implementationSteps: TopAction["implementation_steps"];
  ownerSuggestion: string;
  requiredClientAssets: string[];
  reviewDate: string;
  sequence: number;
  specification: TopAction["specification"];
  validationMetrics: TopAction["validation_metrics"];
  whyNow: string;
}

export interface AdvisorLayerViewModel extends LayerAssessment {
  label: string;
}

export interface AdvisorReportV22ViewModel {
  actions: AdvisorActionViewModel[];
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
  dataCoverage: {
    fullEvidenceCoverage: boolean;
    limitations: string[];
    sources: SourceCoverage[];
  };
  evidence: EvidenceItem[];
  executiveDecision: SearchTrustReportV2_2["executive_decision"];
  findings: Finding[];
  firstPartyPerformance: FirstPartyPerformance;
  header: ReportV22HeaderViewModel;
  layers: AdvisorLayerViewModel[];
  limitations: PublicLimitationViewModel[];
  marketSnapshot: SearchTrustReportV2_2["market_snapshot"];
  mode: "advisor";
  reportMetadata: {
    copyModelVersion: string;
    rulesetVersion: string;
    schemaVersion: string;
  };
  roadmap: ReportV22RoadmapPhaseViewModel[];
  siteInventory: SiteInventorySummary;
  versionDiff: VersionDiff;
}

export type ReportV22ViewModel = ClientReportV22ViewModel | AdvisorReportV22ViewModel;

function headerBase(report: SearchTrustReportV2_2): ReportHeaderBase {
  return {
    businessName: report.identity.business.business_name,
    generatedAt: report.report_version.generated_at,
    location: report.case_context.target_market.display_name,
    primaryService: report.case_context.primary_service,
    reportType: report.report_version.report_type,
    versionNumber: report.report_version.version_number,
  };
}

function buildClientViewModel(report: SearchTrustReportV2_2): ClientReportV22ViewModel {
  const delivery = report.client_delivery;
  return {
    actions: delivery.priority_actions.map((action) => ({
      effort: action.effort_bucket,
      expectedResult: action.expected_result,
      requiredClientAssets: [...(action.required_client_assets ?? [])],
      reviewDate: action.review_date,
      sequence: action.sequence,
      title: action.title,
      whyNow: action.why_now,
    })),
    clientInputs: [...new Set(
      delivery.priority_actions.flatMap((action) => action.required_client_assets ?? []),
    )],
    coverageAppendix: {
      boundarySummary: delivery.coverage_appendix.boundary_summary,
      checkedSources: [...(delivery.coverage_appendix.checked_sources ?? [])],
      unavailableSources: [...(delivery.coverage_appendix.unavailable_sources ?? [])],
    },
    decision: {
      businessImpact: delivery.decision.business_impact,
      headline: delivery.decision.headline,
      opportunity: delivery.decision.opportunity,
    },
    evidenceCards: delivery.evidence_cards.map((card) => ({
      decisionRelevance: card.decision_relevance,
      observation: card.observation,
      sourceLabel: card.source_label,
      subjectLabel: card.subject_label ?? null,
    })),
    header: headerBase(report),
    mode: "client",
    nextReviewDate: delivery.next_review_date,
    roadmap: delivery.roadmap.map((phase) => ({
      expectedResult: phase.expected_result,
      label: REPORT_V22_PERIOD_LABELS[phase.period],
      objective: phase.objective,
      period: phase.period,
    })),
  };
}

function advisorAction(action: TopAction): AdvisorActionViewModel {
  return {
    actionId: action.action_id,
    clientFacingExplanation: action.client_facing_explanation,
    dataSources: [...action.data_sources] as TopAction["data_sources"],
    definitionOfDone: [...action.definition_of_done],
    dependencies: [...(action.dependencies ?? [])],
    effort: action.effort_bucket,
    exactTargets: [...action.exact_targets],
    findingIds: [...action.finding_ids],
    implementationSteps: action.implementation_steps.map((step) => ({ ...step })) as TopAction["implementation_steps"],
    ownerSuggestion: action.owner_suggestion,
    requiredClientAssets: [...(action.required_client_assets ?? [])],
    reviewDate: action.review_date,
    sequence: action.sequence,
    specification: {
      content_requirements: [...(action.specification.content_requirements ?? [])],
      gbp_requirements: [...(action.specification.gbp_requirements ?? [])],
      technical_requirements: [...(action.specification.technical_requirements ?? [])],
    },
    validationMetrics: action.validation_metrics.map((metric) => ({ ...metric })) as TopAction["validation_metrics"],
    whyNow: action.why_now,
  };
}

function buildAdvisorViewModel(report: SearchTrustReportV2_2): AdvisorReportV22ViewModel {
  const actionLabels = new Map(
    report.top_actions.map((action) => [action.action_id, action.client_facing_explanation]),
  );
  return {
    actions: report.top_actions.map(advisorAction),
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
    header: {
      ...headerBase(report),
      caseId: report.identity.case_id,
      reportId: report.report_version.report_id,
      siteUrl: report.identity.business.site_url,
    },
    layers: report.eight_layers.map((layer) => ({
      ...layer,
      label: REPORT_V22_LAYER_LABELS[layer.layer_key],
    })),
    limitations: (report.limitations ?? []).map((limitation) => ({
      category: limitation.category,
      description: limitation.description,
      severity: limitation.severity,
    })),
    marketSnapshot: report.market_snapshot,
    mode: "advisor",
    reportMetadata: {
      copyModelVersion: report.report_version.copy_model_version,
      rulesetVersion: report.report_version.ruleset_version,
      schemaVersion: report.report_version.schema_version,
    },
    roadmap: report.roadmap_30_60_90.phases.map((phase) => ({
      actionIds: [...phase.action_ids],
      actionLabels: phase.action_ids.map((actionId) => actionLabels.get(actionId) ?? actionId),
      exitCriteria: [...phase.exit_criteria],
      label: REPORT_V22_PERIOD_LABELS[phase.period],
      objective: phase.objective,
      period: phase.period,
    })),
    siteInventory: report.site_inventory_summary,
    versionDiff: report.version_diff,
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
  return mode === "client" ? buildClientViewModel(report) : buildAdvisorViewModel(report);
}
