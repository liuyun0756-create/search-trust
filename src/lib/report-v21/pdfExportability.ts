import { normalizeReportToV21 } from "./normalizeReportToV21";

export function isReportPdfExportable(report: unknown): boolean {
  const source = asRecord(report);
  if (!source) return false;

  if (source.status === "completed") return true;
  if (hasNativeReportV21(source.report_v2_1)) return true;
  if (hasLegacyModuleContent(source)) return true;
  if (hasRenderableValue(source.score)) return true;
  if (hasMeaningfulStatusCards(source)) return true;

  try {
    const normalized = normalizeReportToV21(source);
    return (
      (normalized.source === "native" || normalized.source === "legacy_adapted") &&
      normalized.reportV21?.schema_version === "2.1"
    );
  } catch {
    return false;
  }
}

export function getReportPdfExportabilitySignals(report: unknown) {
  const source = asRecord(report);
  if (!source) {
    return {
      hasReportV21: false,
      hasScore: false,
      hasLegacyModules: false,
      hasStatusCards: false,
      hasIdentity: false,
      exportable: false,
    };
  }

  return {
    hasReportV21: hasNativeReportV21(source.report_v2_1),
    hasScore: hasRenderableValue(source.score),
    hasLegacyModules: hasLegacyModuleContent(source),
    hasStatusCards: hasAnyStatusCard(source),
    hasIdentity: hasIdentity(source),
    exportable: isReportPdfExportable(source),
  };
}

function hasNativeReportV21(value: unknown): boolean {
  const parsed = parseJsonMaybe(value);
  const record = asRecord(parsed);
  if (!record) return false;

  const inner = asRecord(record.report_v2_1);
  if (inner) return Object.keys(inner).length > 0;

  return Object.keys(record).length > 0;
}

function hasLegacyModuleContent(report: Record<string, unknown>): boolean {
  return Boolean(
    hasRenderableObject(report.module_1_overview) ||
    hasRenderableObject(report.module_2_page_level) ||
    hasRenderableObject(report.module_3_key_problems) ||
    hasRenderableObject(report.module_4_eight_layers) ||
    hasRenderableObject(report.module_5_optimization)
  );
}

function hasMeaningfulStatusCards(report: Record<string, unknown>): boolean {
  return hasAnyStatusCard(report) && hasIdentity(report);
}

function hasAnyStatusCard(report: Record<string, unknown>): boolean {
  return Boolean(
    hasRenderableValue(report.trust_status) ||
    hasRenderableValue(report.ranking_potential) ||
    hasRenderableValue(report.risk_level)
  );
}

function hasIdentity(report: Record<string, unknown>): boolean {
  return Boolean(
    hasRenderableValue(report.page_url) ||
    hasRenderableValue(report.report_id) ||
    hasRenderableValue(report.id)
  );
}

function hasRenderableObject(value: unknown): boolean {
  const record = asRecord(value);
  return Boolean(record && Object.keys(record).length > 0);
}

function hasRenderableValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  return hasRenderableObject(value);
}

function parseJsonMaybe(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
