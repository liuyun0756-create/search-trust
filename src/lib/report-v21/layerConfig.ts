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
}

export const LAYER_DISPLAY_CONFIG: Record<LayerKey, LayerDisplayConfig> = {
  foundation: {
    label: "L0 Foundation",
    name: "Eligibility",
    shortName: "Foundation",
  },
  entity_presence: {
    label: "L0-A Entity Presence",
    name: "Entity Presence",
    shortName: "Presence",
  },
  entity_consistency: {
    label: "L0-B Entity Consistency",
    name: "Entity Consistency",
    shortName: "Consistency",
  },
  specificity: {
    label: "L1 Specificity",
    name: "Specificity",
    shortName: "Specificity",
  },
  real_world_connection: {
    label: "L2 Real-World Connection",
    name: "Real-World Connection",
    shortName: "Real World",
  },
  accountability: {
    label: "L3 Accountability",
    name: "Accountability",
    shortName: "Accountability",
  },
  page_unique_value: {
    label: "L4 Page Unique Value",
    name: "Page Unique Value",
    shortName: "Unique Value",
  },
  algorithm_fit: {
    label: "L5 Algorithm Fit",
    name: "Algorithm Fit",
    shortName: "Algorithm Fit",
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
  };
}
