import type { LayerKey } from "./types";

export const REQUIRED_LAYER_KEYS: LayerKey[] = [
  "foundation",
  "entity_presence",
  "entity_consistency",
  "specificity",
  "real_world_connection",
  "accountability",
  "page_unique_value",
  "algorithm_fit",
];

export interface LayerDisplayConfig {
  label: string;
  name: string;
  shortName: string;
  signalsAssessed: number;
}

export const LAYER_DISPLAY_CONFIG: Record<LayerKey, LayerDisplayConfig> = {
  foundation: {
    label: "L1 Foundation",
    name: "Foundation",
    shortName: "Foundation",
    signalsAssessed: 4,
  },
  entity_presence: {
    label: "L2 Entity Presence",
    name: "Entity Presence",
    shortName: "Presence",
    signalsAssessed: 5,
  },
  entity_consistency: {
    label: "L3 Entity Consistency",
    name: "Entity Consistency",
    shortName: "Consistency",
    signalsAssessed: 4,
  },
  specificity: {
    label: "L4 Specificity",
    name: "Specificity",
    shortName: "Specificity",
    signalsAssessed: 10,
  },
  real_world_connection: {
    label: "L5 Real-World Connection",
    name: "Real-World Connection",
    shortName: "Real World",
    signalsAssessed: 5,
  },
  accountability: {
    label: "L6 Accountability",
    name: "Accountability",
    shortName: "Accountability",
    signalsAssessed: 3,
  },
  page_unique_value: {
    label: "L7 Page Unique Value",
    name: "Page Unique Value",
    shortName: "Unique Value",
    signalsAssessed: 3,
  },
  algorithm_fit: {
    label: "L8 Algorithm Fit",
    name: "Algorithm Fit",
    shortName: "Algorithm Fit",
    signalsAssessed: 4,
  },
};

export function isLayerKey(value: unknown): value is LayerKey {
  return typeof value === "string" && REQUIRED_LAYER_KEYS.includes(value as LayerKey);
}

export function getLayerDisplayConfig(layerKey: unknown): LayerDisplayConfig {
  if (isLayerKey(layerKey)) return LAYER_DISPLAY_CONFIG[layerKey];
  const fallback = typeof layerKey === "string" && layerKey.trim() ? layerKey.trim() : "unknown";
  return {
    label: fallback,
    name: fallback,
    shortName: fallback,
    signalsAssessed: 0,
  };
}
