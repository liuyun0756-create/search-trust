import { REQUIRED_LAYER_KEYS } from "./layerConfig";

export const OLD_SIX_LAYER_LABELS = [
  "Six-Layer Model",
  "L0-RELEVANCE",
  "L1-ENTITY CLARITY",
  "L2-PROOF SIGNALS",
  "L3-LOCAL FIT",
  "L4-STRUTURAL TRUST",
  "L5-STANDALONE VALUE",
];

const OLD_SIX_LAYER_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Six-Layer Model/gi, "Eight-Layer Model"],
  [/L0-RELEVANCE/gi, "L0 Foundation"],
  [/L1-ENTITY CLARITY/gi, "Entity Presence"],
  [/L2-PROOF SIGNALS/gi, "Entity Consistency"],
  [/L3-LOCAL FIT/gi, "Real-World Connection"],
  [/L4-STRUTURAL TRUST/gi, "Page Unique Value"],
  [/L5-STANDALONE VALUE/gi, "Algorithm Fit"],
];

export interface ClientValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateReportV21Client(value: unknown): ClientValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(value)) {
    return {
      valid: false,
      errors: ["report_v2_1 must be an object"],
      warnings,
    };
  }

  if (value.schema_version !== "2.1") {
    errors.push('schema_version must be "2.1"');
  }

  if (!isRecord(value.gbp_status)) {
    errors.push("gbp_status is required");
  }

  if (!isRecord(value.data_coverage)) {
    errors.push("data_coverage is required");
  }

  if (!Array.isArray(value.layers)) {
    errors.push("layers must be an array");
  } else if (value.layers.length !== REQUIRED_LAYER_KEYS.length) {
    errors.push("layers must contain exactly 8 items");
  } else {
    value.layers.forEach((layer, index) => {
      const actual = isRecord(layer) ? layer.layer_key : undefined;
      const expected = REQUIRED_LAYER_KEYS[index];
      if (actual !== expected) {
        errors.push(`layers[${index}].layer_key must be ${expected}`);
      }
    });
  }

  const serialized = safeSerialize(value).toLowerCase();
  for (const label of OLD_SIX_LAYER_LABELS) {
    if (serialized.includes(label.toLowerCase())) {
      errors.push(`old six-layer label is not allowed: ${label}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function sanitizeOldSixLayerLabels(value: string): string {
  return OLD_SIX_LAYER_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeSerialize(value: unknown): string {
  try {
    return JSON.stringify(value) || "";
  } catch {
    return "";
  }
}
