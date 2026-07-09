import { getLayerDisplayConfig, REQUIRED_LAYER_KEYS } from "./layerConfig";
import { legacyReportToV21 } from "./legacyReportToV21";
import type { LayerFinding, ReportV21, NormalizedReportV21Result } from "./types";
import { validateReportV21Client } from "./validateReportV21Client";

export function normalizeReportToV21(report: any): NormalizedReportV21Result {
  const warnings: string[] = [];

  try {
    const nativeCandidate = clone(report?.report_v2_1);
    if (nativeCandidate) {
      applyTopLevelBranding(nativeCandidate, report);
      const nativeValidation = validateReportV21Client(nativeCandidate);
      if (nativeValidation.valid) {
        return {
          reportV21: nativeCandidate as ReportV21,
          source: "native",
          valid: true,
          errors: [],
          warnings: nativeValidation.warnings,
        };
      }

      const repaired = repairNativeDisplayFields(nativeCandidate);
      const repairedValidation = validateReportV21Client(repaired);
      if (repairedValidation.valid) {
        return {
          reportV21: repaired as ReportV21,
          source: "native",
          valid: true,
          errors: [],
          warnings: [
            ...nativeValidation.errors.map((error) => `Native report repaired: ${error}`),
            ...repairedValidation.warnings,
          ],
        };
      }

      warnings.push(...nativeValidation.errors.map((error) => `Native report_v2_1 was not usable: ${error}`));
    }

    if (hasLegacySignals(report)) {
      const adapted = legacyReportToV21(report);
      const validation = validateReportV21Client(adapted);
      return {
        reportV21: adapted,
        source: "legacy_adapted",
        valid: validation.valid,
        errors: validation.errors,
        warnings: [...warnings, ...validation.warnings],
      };
    }
  } catch (error) {
    warnings.push(`Frontend report_v2_1 normalization recovered from an adapter error: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  const fallback = fallbackReportV21(report);
  const validation = validateReportV21Client(fallback);
  return {
    reportV21: fallback,
    source: "fallback",
    valid: validation.valid,
    errors: validation.errors,
    warnings: [...warnings, "Fallback report_v2_1 generated on the frontend."],
  };
}

function repairNativeDisplayFields(value: unknown): unknown {
  const candidate = clone(value);
  if (!isRecord(candidate) || !Array.isArray(candidate.layers)) return candidate;

  candidate.layers = candidate.layers.map((layer, index) => {
    if (!isRecord(layer)) return layer;
    const layerKey = layer.layer_key || REQUIRED_LAYER_KEYS[index];
    const config = getLayerDisplayConfig(layerKey);
    return {
      ...layer,
      layer_id: typeof layer.layer_id === "number" ? layer.layer_id : index + 1,
      layer_key: layerKey,
      layer_name: typeof layer.layer_name === "string" && layer.layer_name.trim() ? layer.layer_name : config.name,
      layer_label: typeof layer.layer_label === "string" && layer.layer_label.trim() ? layer.layer_label : config.label,
    };
  });

  return candidate;
}

function applyTopLevelBranding(candidate: unknown, report: any) {
  if (!isRecord(candidate)) return;
  if (candidate.agency_branding) return;
  const branding = report?.agency_branding;
  if (!isRecord(branding) || branding.enabled !== true) return;
  candidate.agency_branding = clone(branding);
}

function fallbackReportV21(report: any): ReportV21 {
  const layers: LayerFinding[] = REQUIRED_LAYER_KEYS.map((layerKey, index) => {
    const config = getLayerDisplayConfig(layerKey);
    return {
      layer_id: index + 1,
      layer_key: layerKey,
      layer_name: config.name,
      layer_label: config.label,
      status: "not_checked",
      checked_rule_ids: [],
      triggered_rule_ids: [],
      summary: "This layer was not available in the report payload.",
      explanation: "The frontend generated a fallback v2.1 shape because no compatible report payload was available.",
      evidence_items: [],
      suggested_fixes: [],
      action_items: [],
    };
  });

  return {
    schema_version: "2.1",
    report_id: text(report?.report_id) || text(report?.id) || "frontend-fallback-report",
    analyzed_url: text(report?.page_url) || text(report?.url) || "unknown-url",
    page_type: text(report?.page_type) || "Unknown",
    generated_at: text(report?.generated_at) || text(report?.created_at) || new Date(0).toISOString(),
    gbp_status: {
      status: "not_checked",
      reason: "No compatible v2.1 or legacy report payload was available.",
    },
    data_coverage: {
      page_content_checked: false,
      gbp_checked: false,
      schema_checked: false,
      contact_page_checked: false,
      about_page_checked: false,
      reviews_checked: false,
      internal_pages_checked: false,
      competitor_pages_checked: false,
      limitations: ["Frontend fallback report_v2_1 generated; source report payload was missing or unsupported."],
    },
    overall_status: {
      label: "Unknown",
      level: "medium",
      explanation: "Frontend fallback status; no compatible report payload was available.",
    },
    ranking_potential: {
      label: "Unknown",
      level: "competitive",
      explanation: "Frontend fallback ranking potential; no compatible report payload was available.",
    },
    risk_level: {
      label: "Unknown",
      level: "medium",
      explanation: "Frontend fallback risk level; no compatible report payload was available.",
    },
    primary_blocking_layer: {
      layer_key: "foundation",
      layer_name: getLayerDisplayConfig("foundation").name,
      reason: "No compatible report payload was available.",
      evidence_items: [],
    },
    page_level: {
      label: "Unknown",
      what_it_looks_like: "No compatible report payload was available.",
      strengths: [],
      missing_elements: [],
    },
    layers,
    key_issues: [],
    optimization_path: {
      must_execute_now: [],
      defer_until_later: [],
      do_not_prioritize_yet: [],
      roadmap: [],
      fix_order_warning: "No compatible optimization path was available.",
      completion_signals: [],
    },
    client_summary: {
      title: "Report unavailable",
      plain_language_summary: "The frontend could not normalize this report payload.",
      why_it_matters: "A compatible report_v2_1 or legacy report payload is required for reliable rendering.",
      first_priority: "Reload the report or regenerate the audit.",
      not_first_priority: "Do not treat this fallback as an evidence-backed report.",
      expected_change: "A valid report payload will replace this fallback.",
    },
  };
}

function hasLegacySignals(report: any): boolean {
  return Boolean(
    report?.score ||
    report?.module_1_overview ||
    report?.module_2_page_level ||
    report?.module_3_key_problems ||
    report?.module_4_eight_layers ||
    report?.module_5_optimization ||
    report?.trust_status ||
    report?.ranking_potential ||
    report?.risk_level
  );
}

function clone<T>(value: T): T {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}
