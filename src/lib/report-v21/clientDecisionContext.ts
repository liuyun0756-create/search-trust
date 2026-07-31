import { getLayerDisplayConfig, REQUIRED_LAYER_KEYS } from "./layerConfig";
import { buildAuditWorkPhases } from "./implementationRoadmap";
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
  const confirmedFindingCount = report.layers.reduce((total, layer) => {
    const findingCount = Array.isArray(layer.triggered_findings)
      ? layer.triggered_findings.length
      : 0;
    const ruleCount = Array.isArray(layer.triggered_rule_ids)
      ? layer.triggered_rule_ids.length
      : 0;
    return total + (findingCount || ruleCount);
  }, 0);
  const affectedLayerCount = report.layers.filter(
    (layer) => layer.status === "weak" || layer.status === "medium",
  ).length;
  const workSequence = buildWorkSequence(report);
  const workPhaseCount = new Set(workSequence.map((item) => item.phase_number)).size;
  if (isDecisionContext(existing)) {
    return {
      ...existing,
      issue_count: confirmedFindingCount,
      affected_layer_count: affectedLayerCount,
      work_phase_count: workPhaseCount,
      work_sequence: workSequence,
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

  return {
    priority_level: priorityLevel,
    priority_label: priorityLabel(priorityLevel),
    why_act_now: whyActNow(priorityLevel, earliestKey),
    issue_count: confirmedFindingCount,
    affected_layer_count: affectedLayerCount,
    work_phase_count: workPhaseCount,
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

function buildWorkSequence(report: ReportV21): ClientDecisionWorkPhase[] {
  const workPhases = buildAuditWorkPhases(report);
  const plannedLayerKeys = workPhases.flatMap((phase) => phase.affectedLayers);

  return plannedLayerKeys.map((layerKey) => {
    const layer = report.layers.find((candidate) => candidate.layer_key === layerKey);
    const layerPosition = REQUIRED_LAYER_KEYS.indexOf(layerKey);
    const phaseNumber: 1 | 2 | 3 | 4 = layerPosition <= 2
      ? 1
      : layerPosition <= 4
        ? 2
        : layerPosition <= 6
          ? 3
          : 4;

    return {
      stage: "current" as ClientDecisionStage,
      phase_number: phaseNumber,
      label: getLayerDisplayConfig(layerKey).label,
      layer_keys: [layerKey],
      layer_labels: [getLayerDisplayConfig(layerKey).label],
      task_titles: [],
      summary: layer?.explanation || layer?.summary || "This trust layer needs to be strengthened before the page can compete more reliably.",
    };
  });
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
