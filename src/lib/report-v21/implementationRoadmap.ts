import { getLayerDisplayConfig, REQUIRED_LAYER_KEYS } from "./layerConfig";
import type { ActionItem, LayerKey, OptimizationPath } from "./types";

export interface ImprovementSequencePhase {
  number: 1 | 2 | 3 | 4;
  layerRange: string;
  title: string;
  detail: string;
  completionGate: string;
  observationWindow: string;
}

export interface ActiveWorkPhase extends ImprovementSequencePhase {
  affectedLayers: LayerKey[];
  actions: ActionItem[];
}

export const IMPROVEMENT_SEQUENCE: ImprovementSequencePhase[] = [
  {
    number: 1,
    layerRange: "L1-L3",
    title: "Stabilize the business entity",
    detail: "Establish eligibility, presence, and consistency before expanding the page.",
    completionGate: "Business identity and contact fields are complete and consistent across the checked sources.",
    observationWindow: "7-14 days",
  },
  {
    number: 2,
    layerRange: "L4-L5",
    title: "Build local credibility",
    detail: "Add page-specific local detail and verifiable real-world context.",
    completionGate: "Local and real-world details are published, factual, and visible on the checked page.",
    observationWindow: "14-30 days",
  },
  {
    number: 3,
    layerRange: "L6-L7",
    title: "Add accountable, unique proof",
    detail: "Show responsibility, defensible proof, and value that belongs to this page.",
    completionGate: "Accountability and page-specific proof are published and can be verified.",
    observationWindow: "14-30 days",
  },
  {
    number: 4,
    layerRange: "L8",
    title: "Reassess search-era fit",
    detail: "Re-evaluate Algorithm Fit after the earlier trust signals have improved.",
    completionGate: "Earlier active phases are complete and the page is ready for a fresh full audit.",
    observationWindow: "About 30 days after the main changes",
  },
];

const PHASE_LAYERS: Record<ImprovementSequencePhase["number"], LayerKey[]> = {
  1: ["foundation", "entity_presence", "entity_consistency"],
  2: ["specificity", "real_world_connection"],
  3: ["accountability", "page_unique_value"],
  4: ["algorithm_fit"],
};

export function getOptimizationActions(path: OptimizationPath): ActionItem[] {
  const seen = new Set<string>();
  const result: ActionItem[] = [];
  const candidates = [
    ...safeActions(path.must_execute_now),
    ...safeActions(path.defer_until_later),
    ...safeActions(path.do_not_prioritize_yet),
    ...safeRoadmapActions(path),
  ];

  for (const action of candidates) {
    const key = action.id || `${action.affected_layer}:${action.task_title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }

  return result.sort((left, right) => {
    const layerDifference = REQUIRED_LAYER_KEYS.indexOf(left.affected_layer)
      - REQUIRED_LAYER_KEYS.indexOf(right.affected_layer);
    return layerDifference || left.task_title.localeCompare(right.task_title);
  });
}

export function buildActiveWorkPhases(path: OptimizationPath): ActiveWorkPhase[] {
  const actions = getOptimizationActions(path);

  return IMPROVEMENT_SEQUENCE.flatMap((phase) => {
    const layerKeys = PHASE_LAYERS[phase.number];
    const phaseActions = actions.filter((action) => layerKeys.includes(action.affected_layer));
    if (!phaseActions.length) return [];

    return [{
      ...phase,
      affectedLayers: layerKeys.filter((layerKey) =>
        phaseActions.some((action) => action.affected_layer === layerKey)),
      actions: phaseActions,
    }];
  });
}

export function formatWorkLayer(layerKey: LayerKey): string {
  const layerNumber = REQUIRED_LAYER_KEYS.indexOf(layerKey) + 1;
  return `L${layerNumber} ${getLayerDisplayConfig(layerKey).name}`;
}

function safeActions(value: ActionItem[] | null | undefined): ActionItem[] {
  return Array.isArray(value) ? value : [];
}

function safeRoadmapActions(path: OptimizationPath): ActionItem[] {
  if (!Array.isArray(path.roadmap)) return [];
  return path.roadmap.flatMap((phase) => safeActions(phase.action_items));
}
