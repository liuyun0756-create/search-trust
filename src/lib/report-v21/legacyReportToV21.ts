import { getLayerDisplayConfig, isLayerKey, REQUIRED_LAYER_KEYS } from "./layerConfig";
import type {
  ActionItem,
  DataCoverage,
  EvidenceItem,
  KeyIssue,
  LayerFinding,
  LayerKey,
  LayerStatus,
  OptimizationPath,
  PageLevel,
  ReportV21,
  RiskLevel,
  OverallStatus,
  RankingPotential,
  RoadmapPhase,
} from "./types";
import { sanitizeOldSixLayerLabels } from "./validateReportV21Client";

const LEGACY_LIMITATION = "Legacy report adapted on the frontend; structured v2.1 evidence may be incomplete.";

export function legacyReportToV21(report: any): ReportV21 {
  const source = asRecord(report) ?? {};
  const score = parseObject(source.score);
  const module1 = asRecord(source.module_1_overview) || asRecord(score?.module_1_overview);
  const module2 = asRecord(source.module_2_page_level) || asRecord(score?.module_2_page_level);
  const module3 = asRecord(source.module_3_key_problems) || asRecord(score?.module_3_key_problems);
  const module4 = asRecord(source.module_4_eight_layers) || asRecord(score?.module_4_eight_layers);
  const module5 = asRecord(source.module_5_optimization) || asRecord(score?.module_5_optimization);

  const gbpChecked = source.gbp_connected === true;
  const hasLegacyContent = Boolean(module1 || module2 || module3 || module4 || module5 || score);
  const layers = layersFromLegacy(module4);
  const primaryLayerKey = bestLayerKey(
    text(module1?.primary_blocking_layer)
      || text(asRecord(module3?.primary_trust_failure)?.blocking_layer)
      || text(asRecord(module5?.primary_trust_blocker)?.blocking_layer)
  );

  return {
    schema_version: "2.1",
    report_id: text(source.report_id) || text(source.id) || "frontend-adapted-report",
    analyzed_url: text(source.page_url) || text(source.url) || text(source.analyzed_url) || "unknown-url",
    page_type: text(source.page_type) || "Unknown",
    generated_at: text(source.created_at) || text(source.generated_at) || new Date(0).toISOString(),
    gbp_status: {
      status: gbpChecked ? "checked" : "not_checked",
      gbp_url: gbpChecked ? text(source.gbp_url) || null : null,
      reason: gbpChecked ? "Legacy report marked GBP as connected." : "Legacy report did not include checked GBP status.",
    },
    data_coverage: dataCoverageFromLegacy(hasLegacyContent, gbpChecked),
    overall_status: statusCardFromLegacy(source.trust_status, module1, "Trust Status", "medium"),
    ranking_potential: rankingPotentialFromLegacy(source.ranking_potential, module1),
    risk_level: riskLevelFromLegacy(source.risk_level, module1),
    primary_blocking_layer: {
      layer_key: primaryLayerKey,
      layer_name: getLayerDisplayConfig(primaryLayerKey).name,
      reason: cleanText(
        text(asRecord(module3?.primary_trust_failure)?.description)
          || text(asRecord(module5?.primary_trust_blocker)?.summary)
          || "Legacy report did not provide a structured primary blocking layer reason."
      ),
      evidence_items: [notAvailableEvidence("ev-primary-legacy", "Legacy report did not include structured primary-layer evidence.")],
    },
    page_level: pageLevelFromLegacy(module2),
    layers,
    key_issues: keyIssuesFromLegacy(module3),
    optimization_path: optimizationPathFromLegacy(module5),
    client_summary: {
      title: cleanText(text(module1?.title) || "SearchTrust legacy-adapted summary"),
      plain_language_summary: cleanText(text(module1?.main_conclusion) || text(module1?.summary) || "Legacy report adapted for v2.1 compatibility."),
      why_it_matters: cleanText(text(module1?.explanation) || "Legacy report may not include structured evidence."),
      first_priority: cleanText(text(module1?.primary_blocking_layer) || "Review the primary blocking layer."),
      not_first_priority: "Do not treat legacy-adapted placeholder evidence as complete v2.1 evidence.",
      expected_change: "A native report_v2_1 payload should provide stronger structured evidence and actions.",
    },
  };
}

function dataCoverageFromLegacy(hasLegacyContent: boolean, gbpChecked: boolean): DataCoverage {
  return {
    page_content_checked: hasLegacyContent,
    gbp_checked: gbpChecked,
    schema_checked: false,
    contact_page_checked: false,
    about_page_checked: false,
    reviews_checked: false,
    internal_pages_checked: false,
    competitor_pages_checked: false,
    limitations: [LEGACY_LIMITATION],
  };
}

function layersFromLegacy(module4: Record<string, unknown> | null): LayerFinding[] {
  const rawLayers = Array.isArray(module4?.layers) ? module4.layers : [];
  const byKey = new Map<LayerKey, Record<string, unknown>>();
  rawLayers.forEach((raw) => {
    const layer = asRecord(raw);
    const key = bestLayerKey(text(layer?.layer_key));
    if (layer && isLayerKey(key)) byKey.set(key, layer);
  });

  return REQUIRED_LAYER_KEYS.map((layerKey, index) => {
    const config = getLayerDisplayConfig(layerKey);
    const legacy = byKey.get(layerKey);
    const explanation = cleanText(text(legacy?.description) || text(legacy?.explanation) || "Legacy report did not provide this layer explanation.");
    return {
      layer_id: index + 1,
      layer_key: layerKey,
      layer_name: config.name,
      layer_label: config.label,
      status: statusFromLegacy(legacy?.status),
      checked_rule_ids: [],
      triggered_rule_ids: [],
      summary: explanation,
      explanation,
      evidence_items: [],
      suggested_fixes: [],
      action_items: [],
    };
  });
}

function keyIssuesFromLegacy(module3: Record<string, unknown> | null): KeyIssue[] {
  const rawIssues = Array.isArray(module3?.concrete_issues) ? module3.concrete_issues : [];
  return rawIssues.flatMap((raw, index) => {
    const issue = asRecord(raw);
    if (!issue) return [];
    const title = cleanText(text(issue.title) || text(issue.issue_title) || `Legacy issue ${index + 1}`);
    const layerKey = bestLayerKey(text(issue.affected_layer) || title);
    return [{
      id: `legacy-issue-${index + 1}`,
      issue_title: title,
      affected_layer: layerKey,
      related_rule_ids: [],
      severity: "medium",
      evidence_items: [notAvailableEvidence(`ev-legacy-issue-${index + 1}`, "Legacy issue did not include structured evidence.")],
      explanation: cleanText(text(issue.explanation) || text(issue.judgement) || "Legacy issue did not include a structured explanation."),
      why_it_matters: cleanText(stringList(issue.impacts).join(" ") || "This issue may limit page trust signals."),
      recommended_actions: [legacyAction(`legacy-action-${index + 1}`, layerKey, `Review: ${title}`, issue.suggestions)],
    } satisfies KeyIssue];
  });
}

function optimizationPathFromLegacy(module5: Record<string, unknown> | null): OptimizationPath {
  const mustExecute = asRecord(module5?.must_execute_now);
  const rawMustItems = Array.isArray(mustExecute?.items) ? mustExecute.items : [];
  const roadmap = Array.isArray(module5?.roadmap) ? module5.roadmap : [];
  const blocker = asRecord(module5?.primary_trust_blocker);

  return {
    must_execute_now: rawMustItems.flatMap((raw, index) => {
      const item = asRecord(raw);
      if (!item) return [];
      return [legacyAction(
        `legacy-must-${index + 1}`,
        bestLayerKey(text(item.affected_layer) || text(item.title)),
        cleanText(text(item.title) || `Legacy action ${index + 1}`),
        item.execution_focus,
        item.completion_signals,
        text(item.expected_impact)
      )];
    }),
    defer_until_later: [],
    do_not_prioritize_yet: [],
    roadmap: roadmap.flatMap((raw, index) => {
      const phase = asRecord(raw);
      if (!phase) return [];
      return [{
        id: `legacy-phase-${index + 1}`,
        phase_title: cleanText(text(phase.phase_title) || `Legacy phase ${index + 1}`),
        sequence: index + 1,
        goal: cleanText(text(phase.goal) || "Legacy roadmap goal was not structured."),
        entry_condition: cleanText(text(phase.entry_condition) || ""),
        action_items: [],
        expected_outcomes: stringList(phase.expected_outcomes).map(cleanText),
      } satisfies RoadmapPhase];
    }),
    fix_order_warning: cleanText(text(blocker?.why_cannot_skip) || text(module5?.fix_order_warning) || "Legacy report did not include a structured fix-order warning."),
    completion_signals: [],
  };
}

function legacyAction(
  id: string,
  layerKey: LayerKey,
  title: string,
  suggestions: unknown,
  completionSignals: unknown = null,
  expectedEffect = ""
): ActionItem {
  const whatToAdd = stringList(suggestions).map(cleanText);
  return {
    id,
    priority: "medium",
    task_title: cleanText(title),
    affected_layer: layerKey,
    related_rule_ids: [],
    where_to_add: ["Relevant page sections identified during implementation."],
    what_to_add: whatToAdd.length ? whatToAdd : ["Review the legacy recommendation and add missing trust-supporting details."],
    example_copy: [],
    implementation_notes: ["Adapted from legacy report output; structured v2.1 implementation detail was not available."],
    completion_signals: stringList(completionSignals).map(cleanText),
    expected_effect: cleanText(expectedEffect) || "Improves the affected trust layer when implemented with page-specific evidence.",
    effort_level: "medium",
  };
}

function pageLevelFromLegacy(module2: Record<string, unknown> | null): PageLevel {
  return {
    label: cleanText(text(module2?.page_level) || text(module2?.label) || "Legacy page level"),
    what_it_looks_like: cleanText(text(module2?.current_assessment) || text(module2?.what_it_looks_like) || "Legacy report did not include a v2.1 page-level explanation."),
    strengths: stringList(module2?.strengths || module2?.existing_foundation).map(cleanText),
    missing_elements: stringList(module2?.missing_elements || module2?.main_limitation).map(cleanText),
  };
}

function statusCardFromLegacy(
  raw: unknown,
  module1: Record<string, unknown> | null,
  fallbackLabel: string,
  fallbackLevel: OverallStatus["level"]
): OverallStatus {
  const parsed = parseObject(raw);
  const rawValue = text(parsed?.level) || text(parsed?.value) || text(parsed?.label) || text(module1?.current_status);
  const level = overallLevel(rawValue) || fallbackLevel;
  return {
    label: cleanText(text(parsed?.label) || fallbackLabel),
    level,
    explanation: cleanText(text(parsed?.explanation) || text(parsed?.description) || "Adapted from legacy status output."),
  };
}

function rankingPotentialFromLegacy(raw: unknown, module1: Record<string, unknown> | null): RankingPotential {
  const parsed = parseObject(raw);
  const rawValue = text(parsed?.level) || text(parsed?.value) || text(parsed?.label) || text(module1?.ranking_potential);
  return {
    label: cleanText(text(parsed?.label) || "Ranking Potential"),
    level: rankingLevel(rawValue),
    explanation: cleanText(text(parsed?.explanation) || text(parsed?.description) || "Adapted from legacy ranking potential output."),
  };
}

function riskLevelFromLegacy(raw: unknown, module1: Record<string, unknown> | null): RiskLevel {
  const parsed = parseObject(raw);
  const rawValue = text(parsed?.level) || text(parsed?.value) || text(parsed?.label) || text(module1?.risk_level);
  return {
    label: cleanText(text(parsed?.label) || "Risk Level"),
    level: riskLevel(rawValue),
    explanation: cleanText(text(parsed?.explanation) || text(parsed?.description) || "Adapted from legacy risk output."),
  };
}

function notAvailableEvidence(id: string, explanation: string): EvidenceItem {
  return {
    id,
    source_type: "not_available",
    source_label: "Legacy report",
    comparison_result: "not_checked",
    confidence: "low",
    explanation,
  };
}

function statusFromLegacy(value: unknown): LayerStatus {
  const raw = text(value).toLowerCase();
  if (["good", "良好"].includes(raw)) return "good";
  if (["medium", "fair", "一般"].includes(raw)) return "medium";
  if (["weak", "偏弱"].includes(raw)) return "weak";
  if (raw === "not_checked") return "not_checked";
  return "not_checked";
}

function overallLevel(value: string): OverallStatus["level"] | null {
  const raw = value.toLowerCase();
  if (raw.includes("medium-low") || raw.includes("medium weak") || raw.includes("中等偏弱")) return "medium_weak";
  if (raw.includes("weak") || raw.includes("偏弱")) return "weak";
  if (raw.includes("high")) return "high";
  if (raw.includes("strong") || raw.includes("良好")) return "strong";
  if (raw.includes("medium") || raw.includes("moderate") || raw.includes("中等")) return "medium";
  return null;
}

function rankingLevel(value: string): RankingPotential["level"] {
  const raw = value.toLowerCase();
  if (raw.includes("low") || raw.includes("较低")) return "low";
  if (raw.includes("strong") || raw.includes("high") || raw.includes("较强")) return "strong";
  if (raw.includes("improv") || raw.includes("提升")) return "improvable";
  return "competitive";
}

function riskLevel(value: string): RiskLevel["level"] {
  const raw = value.toLowerCase();
  if (raw.includes("medium-high") || raw.includes("medium high") || raw.includes("中高")) return "medium_high";
  if (raw.includes("high") || raw.includes("高")) return "high";
  if (raw.includes("low") || raw.includes("低")) return "low";
  return "medium";
}

function bestLayerKey(value: string): LayerKey {
  const raw = value.toLowerCase();
  for (const key of REQUIRED_LAYER_KEYS) {
    if (raw.includes(key)) return key;
  }
  if (raw.includes("presence") || raw.includes("l0-a")) return "entity_presence";
  if (raw.includes("consistency") || raw.includes("l0-b")) return "entity_consistency";
  if (raw.includes("specific")) return "specificity";
  if (raw.includes("real") || raw.includes("connection")) return "real_world_connection";
  if (raw.includes("account")) return "accountability";
  if (raw.includes("unique") || raw.includes("value")) return "page_unique_value";
  if (raw.includes("algorithm")) return "algorithm_fit";
  return "foundation";
}

function parseObject(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value);
  if (record) return record;
  if (typeof value !== "string") return null;
  try {
    let cleaned = value.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    return asRecord(JSON.parse(cleaned));
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const single = text(value);
  return single ? [single] : [];
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" ");
  return String(value).trim();
}

function cleanText(value: string): string {
  return sanitizeOldSixLayerLabels(value).trim();
}
