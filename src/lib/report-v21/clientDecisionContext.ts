import { getLayerDisplayConfig, REQUIRED_LAYER_KEYS } from "./layerConfig";
import type {
  ClientDecisionContext,
  ClientDecisionPriority,
  ClientDecisionStage,
  ClientDecisionWorkPhase,
  LayerKey,
  ReportV21,
} from "./types";

export function getClientDecisionContext(report: ReportV21): ClientDecisionContext {
  const existing = report.client_summary?.decision_context;
  const affectedLayerCount = report.layers.filter(
    (layer) => layer.status === "weak" || layer.status === "medium",
  ).length;
  if (isDecisionContext(existing)) {
    return {
      ...existing,
      affected_layer_count: affectedLayerCount,
    };
  }

  const issues = Array.isArray(report.key_issues) ? report.key_issues : [];
  const affected = new Set(
    issues
      .map((issue) => issue.affected_layer)
      .filter((key): key is LayerKey => REQUIRED_LAYER_KEYS.includes(key)),
  );
  const orderedKeys = REQUIRED_LAYER_KEYS.filter((key) => affected.has(key));
  const earliestKey = orderedKeys[0];
  const earliestNumber = earliestKey ? REQUIRED_LAYER_KEYS.indexOf(earliestKey) + 1 : null;
  const priorityLevel = priorityForLayer(earliestNumber);
  const workSequence = buildWorkSequence(orderedKeys);

  return {
    priority_level: priorityLevel,
    priority_label: priorityLabel(priorityLevel),
    why_act_now: whyActNow(priorityLevel, earliestKey),
    issue_count: issues.length,
    affected_layer_count: affectedLayerCount,
    work_phase_count: workSequence.length,
    score_interpretation: [
      `Trust Status (${report.overall_status?.label || "Not available"}) describes current page strength.`,
      `Ranking Potential (${report.ranking_potential?.label || "Not available"}) describes the upside available after repair.`,
      `Risk Level (${report.risk_level?.label || "Not available"}) measures the coverage of severe weak layers; it does not mean confirmed issues can be ignored.`,
    ].join(" "),
    work_sequence: workSequence,
  };
}

function priorityForLayer(layerNumber: number | null): ClientDecisionPriority {
  if (layerNumber == null) return "monitor";
  if (layerNumber <= 3) return "immediate";
  if (layerNumber <= 5) return "high";
  return "planned";
}

function priorityLabel(priority: ClientDecisionPriority): string {
  return {
    immediate: "Immediate foundation repair",
    high: "High-priority trust repair",
    planned: "Planned trust strengthening",
    monitor: "Monitor and maintain",
  }[priority];
}

function whyActNow(priority: ClientDecisionPriority, earliestKey?: LayerKey): string {
  if (!earliestKey) {
    return "No confirmed Key Issues were produced. Maintain the current trust signals and re-audit after meaningful page or business changes.";
  }

  const layerLabel = getLayerDisplayConfig(earliestKey).label;
  if (priority === "immediate") {
    return `Confirmed issues begin at ${layerLabel}. Lower-numbered layers support the work above them, so later optimization can deliver weaker returns until this foundation is repaired.`;
  }
  if (priority === "high") {
    return `Confirmed issues begin at ${layerLabel}. Addressing this page-level trust gap now makes later proof and differentiation work more credible.`;
  }
  return `Core foundations are holding, but the confirmed gaps begin at ${layerLabel} and still limit how distinctive and defensible the page can become.`;
}

function buildWorkSequence(orderedKeys: LayerKey[]): ClientDecisionWorkPhase[] {
  if (!orderedKeys.length) return [];

  const earliestKey = orderedKeys[0];
  const earliestIndex = REQUIRED_LAYER_KEYS.indexOf(earliestKey);
  const buildNext = orderedKeys
    .slice(1)
    .filter((key) => REQUIRED_LAYER_KEYS.indexOf(key) <= 4);
  const strengthenAfter = orderedKeys
    .filter((key) => REQUIRED_LAYER_KEYS.indexOf(key) >= 5 && key !== earliestKey);
  const phases = [
    phase(
      "fix_first",
      "Fix first",
      [earliestKey],
      `Resolve ${getLayerDisplayConfig(earliestKey).label} before investing in later-layer work.`,
    ),
  ];

  if (buildNext.length) {
    phases.push(phase(
      "build_next",
      "Build next",
      buildNext,
      "Build the next page-level trust foundations after the first blocker is resolved.",
    ));
  }
  if (strengthenAfter.length) {
    phases.push(phase(
      "strengthen_after",
      "Strengthen after",
      strengthenAfter,
      "Strengthen accountability, differentiation, and current search-era fit.",
    ));
  }
  if (earliestIndex >= 5 && phases.length === 1) {
    phases[0].summary = `Strengthen ${getLayerDisplayConfig(earliestKey).label} as the first confirmed opportunity.`;
  }
  return phases;
}

function phase(
  stage: ClientDecisionStage,
  label: string,
  layerKeys: LayerKey[],
  summary: string,
): ClientDecisionWorkPhase {
  return {
    stage,
    label,
    layer_keys: layerKeys,
    layer_labels: layerKeys.map((key) => getLayerDisplayConfig(key).label),
    summary,
  };
}

function isDecisionContext(value: unknown): value is ClientDecisionContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<ClientDecisionContext>;
  return (
    ["immediate", "high", "planned", "monitor"].includes(context.priority_level || "")
    && typeof context.priority_label === "string"
    && typeof context.why_act_now === "string"
    && typeof context.issue_count === "number"
    && typeof context.affected_layer_count === "number"
    && typeof context.work_phase_count === "number"
    && typeof context.score_interpretation === "string"
    && Array.isArray(context.work_sequence)
  );
}
