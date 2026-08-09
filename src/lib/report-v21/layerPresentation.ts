import { getLayerDisplayConfig } from "./layerConfig";
import type { GBPStatusValue, LayerFinding } from "./types";

const GBP_UNAVAILABLE_SUMMARY = "GBP data was not available, so this layer was not checked.";
const GBP_UNAVAILABLE_EXPLANATION =
  "Entity consistency requires a verified GBP profile. No page-to-GBP conclusion was made.";

/**
 * Apply presentation-only coverage rules without changing backend scoring.
 * L3 cannot be described as healthy when no verified GBP comparison exists.
 */
export function getDisplayLayerFinding(
  layer: LayerFinding,
  gbpStatus: GBPStatusValue | null | undefined,
): LayerFinding {
  if (layer.layer_key !== "entity_consistency" || gbpStatus === "checked") {
    return layer;
  }

  return {
    ...layer,
    status: "not_checked",
    presentation_mode: "attention",
    checked_rule_ids: [],
    triggered_rule_ids: [],
    triggered_findings: [],
    summary: GBP_UNAVAILABLE_SUMMARY,
    explanation: GBP_UNAVAILABLE_EXPLANATION,
    evidence_items: (layer.evidence_items || []).filter(
      (item) => item.comparison_result === "not_checked",
    ),
    suggested_fixes: [],
    action_items: [],
  };
}

export function getDisplaySignalsAssessed(layer: LayerFinding): number {
  return layer.status === "not_checked"
    ? 0
    : getLayerDisplayConfig(layer.layer_key).signalsAssessed;
}
