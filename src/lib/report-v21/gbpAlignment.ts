import { getLayerDisplayConfig, isLayerKey } from "./layerConfig";
import type { EvidenceItem, LayerKey, ReportV21 } from "./types";

export type GBPAlignmentStatus = "match" | "mismatch" | "partial" | "missing" | "not_checked";

export type GBPAlignmentFieldKey =
  | "business_name"
  | "address"
  | "phone"
  | "service_area"
  | "opening_hours"
  | "primary_category"
  | "website"
  | "reviews"
  | "other";

export interface GBPAlignmentRow {
  field_key: GBPAlignmentFieldKey;
  field_label: string;
  page_value: string;
  gbp_value: string;
  status: GBPAlignmentStatus;
  impact: string;
  suggested_fix: string;
  related_layer_keys: LayerKey[];
  evidence_items?: EvidenceItem[];
}

export interface GBPAlignmentExtractionResult {
  rows: GBPAlignmentRow[];
  source: "structured" | "none";
  warnings: string[];
}

const FIELD_LABELS: Record<GBPAlignmentFieldKey, string> = {
  business_name: "Business name",
  address: "Address",
  phone: "Phone",
  service_area: "Service area",
  opening_hours: "Opening hours",
  primary_category: "Primary category",
  website: "Website",
  reviews: "Reviews",
  other: "Other",
};

const VALID_STATUSES: GBPAlignmentStatus[] = ["match", "mismatch", "partial", "missing", "not_checked"];
const DEFAULT_RELATED_LAYERS: LayerKey[] = ["entity_presence", "entity_consistency"];

export function extractGBPAlignmentRows(reportV21: ReportV21): GBPAlignmentExtractionResult {
  const warnings: string[] = [];
  const alignment = (reportV21 as unknown as { gbp_alignment?: unknown })?.gbp_alignment;
  const sourceRows = rowsFromAlignment(alignment);

  if (!sourceRows.length) {
    return { rows: [], source: "none", warnings };
  }

  const rows = sourceRows.flatMap((row, index) => {
    const normalized = normalizeRow(row);
    if (!normalized) {
      warnings.push(`Dropped invalid GBP alignment row at index ${index}.`);
      return [];
    }
    return [normalized];
  });

  return {
    rows,
    source: rows.length ? "structured" : "none",
    warnings,
  };
}

function rowsFromAlignment(alignment: unknown): unknown[] {
  const record = asRecord(alignment);
  if (!record) return [];

  for (const key of ["rows", "fields", "comparisons"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function normalizeRow(value: unknown): GBPAlignmentRow | null {
  const row = asRecord(value);
  if (!row) return null;

  const fieldKey = normalizeFieldKey(text(row.field_key) || text(row.field) || text(row.key));
  const status = normalizeStatus(row.status);
  if (!status) return null;

  return {
    field_key: fieldKey,
    field_label: normalizeFieldLabel(fieldKey, row),
    page_value: safeText(row.page_value ?? row.page_signal ?? row.pageSignal ?? row.page),
    gbp_value: safeText(row.gbp_value ?? row.gbp_signal ?? row.gbpSignal ?? row.gbp),
    status,
    impact: safeText(row.impact),
    suggested_fix: safeText(row.suggested_fix ?? row.suggestedFix ?? row.fix),
    related_layer_keys: normalizeLayerKeys(row.related_layer_keys ?? row.relatedLayers),
    evidence_items: normalizeEvidence(row.evidence_items ?? row.evidenceItems),
  };
}

function normalizeFieldKey(value: string): GBPAlignmentFieldKey {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (normalized.includes("name")) return "business_name";
  if (normalized.includes("address") || normalized.includes("nap")) return "address";
  if (normalized.includes("phone") || normalized.includes("tel")) return "phone";
  if (normalized.includes("service") || normalized.includes("area") || normalized.includes("city")) return "service_area";
  if (normalized.includes("hour")) return "opening_hours";
  if (normalized.includes("category")) return "primary_category";
  if (normalized.includes("website") || normalized.includes("url")) return "website";
  if (normalized.includes("review")) return "reviews";
  return "other";
}

function normalizeFieldLabel(fieldKey: GBPAlignmentFieldKey, row: Record<string, unknown>): string {
  const explicit = safeText(row.field_label ?? row.fieldLabel ?? row.label);
  return explicit || FIELD_LABELS[fieldKey];
}

function normalizeStatus(value: unknown): GBPAlignmentStatus | null {
  const normalized = text(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!normalized) return null;
  if (VALID_STATUSES.includes(normalized as GBPAlignmentStatus)) return normalized as GBPAlignmentStatus;
  if (normalized === "matched" || normalized === "same") return "match";
  if (normalized === "different" || normalized === "conflict") return "mismatch";
  if (normalized === "incomplete") return "partial";
  if (normalized === "unavailable" || normalized === "unchecked") return "not_checked";
  return null;
}

function normalizeLayerKeys(value: unknown): LayerKey[] {
  const raw = Array.isArray(value) ? value : [];
  const keys = raw.filter(isLayerKey);
  return keys.length ? keys : DEFAULT_RELATED_LAYERS;
}

function normalizeEvidence(value: unknown): EvidenceItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const evidence = value.filter((item): item is EvidenceItem => {
    const record = asRecord(item);
    return Boolean(record?.id && record?.source_type && record?.comparison_result && record?.confidence);
  });
  return evidence.length ? evidence : undefined;
}

export function formatAlignmentLayerLabel(layerKey: LayerKey): string {
  return getLayerDisplayConfig(layerKey).label;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function safeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}
