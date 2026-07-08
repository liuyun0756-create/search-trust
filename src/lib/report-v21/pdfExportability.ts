import { normalizeReportToV21 } from "./normalizeReportToV21";

export function isReportPdfExportable(report: unknown): boolean {
  const source = asRecord(report);
  if (!source) return false;

  if (source.status === "completed") return true;
  if (hasLegacyRenderableContent(source)) return true;

  try {
    const normalized = normalizeReportToV21(source);
    return normalized.source !== "fallback" && normalized.reportV21?.schema_version === "2.1";
  } catch {
    return false;
  }
}

function hasLegacyRenderableContent(report: Record<string, unknown>): boolean {
  return Boolean(
    hasRenderableObject(report.report_v2_1) ||
    hasRenderableObject(report.module_1_overview) ||
    hasRenderableObject(report.module_2_page_level) ||
    hasRenderableObject(report.module_3_key_problems) ||
    hasRenderableObject(report.module_4_eight_layers) ||
    hasRenderableObject(report.module_5_optimization) ||
    hasRenderableValue(report.score) ||
    hasRenderableValue(report.trust_status) ||
    hasRenderableValue(report.ranking_potential) ||
    hasRenderableValue(report.risk_level)
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
