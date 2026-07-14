import React from "react";
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  extractGBPAlignmentRows,
  getEffectiveBranding,
  getLayerDisplayConfig,
  normalizeReportToV21,
  REQUIRED_LAYER_KEYS,
} from "@/lib/report-v21";
import type {
  ActionItem,
  EvidenceItem,
  GBPAlignmentRow,
  LayerFinding,
  LayerKey,
  NormalizedReportV21Result,
  ReportV21,
} from "@/lib/report-v21";
import type { EffectiveBranding } from "@/lib/report-v21";
import { filterClientLimitations } from "@/components/report/v21/viewMode";
import type { Report } from "@/types/database";

const UNVERIFIED_GBP_MESSAGE = "GBP was not checked in this report, so GBP alignment could not be verified.";

const STATUS_COLORS: Record<string, string> = {
  good: "#059669",
  medium: "#D97706",
  weak: "#DC2626",
  not_checked: "#6B7280",
  low: "#059669",
  medium_high: "#DC2626",
  high: "#DC2626",
  strong: "#059669",
  competitive: "#4F46E5",
  improvable: "#D97706",
  weak_status: "#DC2626",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 38,
    paddingHorizontal: 28,
    fontSize: 9,
    color: "#1A212B",
    fontFamily: "Helvetica",
    backgroundColor: "#F8F9FA",
  },
  headerCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  title: {
    fontSize: 27,
    fontWeight: 700,
    marginBottom: 6,
  },
  eyebrow: {
    color: "#7A8A15",
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  urlBox: {
    borderWidth: 1,
    borderColor: "#CFE7A8",
    backgroundColor: "#FBFFF1",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  pageUrl: {
    color: "#1D4ED8",
    fontSize: 10,
    fontWeight: 700,
  },
  metaGrid: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
  },
  metaItem: {
    width: "25%",
    padding: 9,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  metaItemLast: {
    borderRightWidth: 0,
  },
  metaLabel: {
    color: "#6B7280",
    fontSize: 7,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  metaValue: {
    color: "#111827",
    fontSize: 8.5,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  sourceBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 9,
    color: "#475569",
    fontSize: 7.5,
    fontWeight: 700,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  agencyPanel: {
    borderWidth: 1,
    borderColor: "#E4EDD2",
    borderRadius: 10,
    backgroundColor: "#FBFDF5",
    padding: 10,
    marginBottom: 12,
  },
  agencyBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D6E8A8",
    borderRadius: 8,
    color: "#7A8A15",
    fontSize: 7,
    fontWeight: 700,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  agencyTitle: {
    color: "#111827",
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 3,
    lineHeight: 1.25,
  },
  agencyText: {
    color: "#4B5563",
    fontSize: 8,
    lineHeight: 1.35,
    marginBottom: 2,
  },
  agencyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  agencyLogo: {
    width: 34,
    height: 34,
    objectFit: "contain",
    marginRight: 8,
  },
  scoreRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  scoreCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 11,
    width: "32%",
    minHeight: 94,
    marginRight: 8,
  },
  scoreCardLast: {
    marginRight: 0,
  },
  scoreLabel: {
    color: "#6B7280",
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  scoreValue: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 6,
    lineHeight: 1.2,
  },
  scoreDesc: {
    color: "#4B5563",
    fontSize: 8,
    lineHeight: 1.4,
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    marginBottom: 14,
    overflow: "hidden",
  },
  sectionHeader: {
    backgroundColor: "#F8FAF5",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionAccent: {
    width: 4,
    height: 17,
    borderRadius: 3,
    backgroundColor: "#A5D020",
    marginRight: 9,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
  },
  sectionBody: {
    padding: 14,
  },
  bodyText: {
    color: "#374151",
    fontSize: 9,
    lineHeight: 1.45,
  },
  mutedText: {
    color: "#6B7280",
    fontSize: 8,
    lineHeight: 1.4,
  },
  label: {
    color: "#6B7280",
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  statement: {
    backgroundColor: "#F3F8FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 10,
    padding: 11,
    marginBottom: 10,
  },
  twoColumn: {
    flexDirection: "row",
  },
  column: {
    width: "49%",
    marginRight: 8,
  },
  columnLast: {
    marginRight: 0,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
    marginBottom: 9,
    backgroundColor: "#FFFFFF",
  },
  softCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 10,
    marginBottom: 9,
    backgroundColor: "#F8FAFC",
  },
  cardTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    marginBottom: 5,
    lineHeight: 1.25,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F3",
    marginVertical: 8,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 4,
  },
  bulletMark: {
    width: 10,
    color: "#8DBB16",
    fontSize: 9,
  },
  bulletText: {
    flex: 1,
    color: "#374151",
    fontSize: 8.5,
    lineHeight: 1.35,
  },
  badge: {
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
    fontSize: 7.5,
    fontWeight: 700,
    alignSelf: "flex-start",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  layerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  layerCard: {
    width: "48.7%",
    marginRight: 7,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#FFFFFF",
  },
  layerCardEven: {
    marginRight: 0,
  },
  layerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  layerTitle: {
    fontSize: 9.5,
    fontWeight: 700,
    width: "68%",
    lineHeight: 1.25,
  },
  table: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableHeader: {
    backgroundColor: "#F1F5F9",
  },
  tableCell: {
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  tableHeadText: {
    fontSize: 7,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
  },
  tableText: {
    fontSize: 7.4,
    color: "#374151",
    lineHeight: 1.25,
  },
  methodFooter: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  fixedFooter: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#9CA3AF",
    fontSize: 8,
  },
});

function safeText(value: unknown, fallback = "-"): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function optionalText(value: unknown): string {
  const rendered = safeText(value, "");
  return rendered === "-" ? "" : rendered;
}

function truncateText(value: unknown, maxLength = 280): string {
  const rendered = safeText(value);
  if (rendered.length <= maxLength) return rendered;
  return `${rendered.slice(0, maxLength - 3).trim()}...`;
}

function compactTextMiddle(value: unknown, maxLength = 28): string {
  const rendered = safeText(value);
  if (rendered.length <= maxLength) return rendered;
  const keepStart = Math.max(8, Math.floor((maxLength - 3) * 0.58));
  const keepEnd = Math.max(6, maxLength - 3 - keepStart);
  return `${rendered.slice(0, keepStart)}...${rendered.slice(-keepEnd)}`;
}

function safeList<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function sourceLabel(source: NormalizedReportV21Result["source"]): string {
  if (source === "native") return "Native v2.1";
  if (source === "legacy_adapted") return "Legacy adapted";
  return "Fallback";
}

function labelize(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusColor(value: string): string {
  return STATUS_COLORS[value] || "#4F46E5";
}

function statusBadgeColors(value: string) {
  if (value === "good" || value === "low" || value === "checked" || value === "match") {
    return { backgroundColor: "#ECFDF5", color: "#047857" };
  }
  if (value === "weak" || value === "high" || value === "medium_high" || value === "error" || value === "mismatch") {
    return { backgroundColor: "#FEF2F2", color: "#B91C1C" };
  }
  if (value === "not_checked" || value === "not_found" || value === "missing") {
    return { backgroundColor: "#F3F4F6", color: "#4B5563" };
  }
  return { backgroundColor: "#FFFBEB", color: "#B45309" };
}

function formatDate(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "UTC", timeZoneName: "short",
  }).format(date);
}

function displayLayer(layerKey: LayerKey | string): string {
  return getLayerDisplayConfig(layerKey).label;
}

function Field({ label, value, maxLength = 360 }: { label: string; value: unknown; maxLength?: number }) {
  const rendered = truncateText(value, maxLength);
  if (rendered === "-") return null;
  return (
    <View style={{ marginBottom: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.bodyText}>{rendered}</Text>
    </View>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <Text style={[styles.badge, statusBadgeColors(value)]}>
      {labelize(value)}
    </Text>
  );
}

function BulletList({
  items,
  limit,
  maxLength = 240,
}: {
  items?: unknown[] | null;
  limit?: number;
  maxLength?: number;
}) {
  const rendered = safeList(items)
    .map((item) => truncateText(item, maxLength))
    .filter((item) => item !== "-")
    .slice(0, limit);

  if (!rendered.length) return null;

  return (
    <View>
      {rendered.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.bullet}>
          <Text style={styles.bulletMark}>-</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionAccent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ScoreCard({
  label,
  value,
  description,
  level,
  isLast,
}: {
  label: string;
  value: string;
  description: string;
  level: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.scoreCard, isLast ? styles.scoreCardLast : {}]}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={[styles.scoreValue, { color: statusColor(level) }]}>{value}</Text>
      <Text style={styles.scoreDesc}>{truncateText(description, 210)}</Text>
    </View>
  );
}

function EvidenceSummary({ evidence, limit = 1 }: { evidence?: EvidenceItem[]; limit?: number }) {
  const items = safeList(evidence)
    .slice(0, limit)
    .map((item) => {
      const parts = [
        optionalText(item.source_label),
        optionalText(item.page_section),
        optionalText(item.extracted_text),
        optionalText(item.explanation),
      ].filter(Boolean);
      return parts.join(": ");
    })
    .filter(Boolean);

  if (!items.length) return null;
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={styles.label}>Evidence summary</Text>
      <BulletList items={items} limit={limit} maxLength={230} />
    </View>
  );
}

function ActionCard({ action, compact = false }: { action: ActionItem; compact?: boolean }) {
  return (
    <View style={styles.softCard}>
      <View style={styles.row}>
        <Text style={[styles.cardTitle, { flex: 1, marginBottom: 0 }]}>{truncateText(action.task_title, 110)}</Text>
        <StatusBadge value={action.priority} />
      </View>
      <Field label="Affected Layer" value={displayLayer(action.affected_layer)} maxLength={120} />
      <Field label="Where To Add" value={safeList(action.where_to_add).join("; ")} maxLength={compact ? 160 : 260} />
      <Field label="What To Add" value={safeList(action.what_to_add).join("; ")} maxLength={compact ? 180 : 280} />
      {safeList(action.example_copy).length > 0 && (
        <View style={{ marginBottom: 7 }}>
          <Text style={styles.label}>Example Copy</Text>
          <BulletList items={action.example_copy} limit={compact ? 1 : 3} maxLength={compact ? 180 : 280} />
        </View>
      )}
      {!compact && <Field label="Expected Effect" value={action.expected_effect} maxLength={240} />}
      <View style={styles.row}>
        <Text style={styles.mutedText}>Effort: {labelize(safeText(action.effort_level, "medium"))}</Text>
      </View>
    </View>
  );
}

function ReportHeader({
  report,
  reportV21,
  normalized,
  brandingOverride,
}: {
  report: Report;
  reportV21: ReportV21;
  normalized: NormalizedReportV21Result;
  brandingOverride?: EffectiveBranding;
}) {
  const branding = brandingOverride ?? getEffectiveBranding(reportV21);
  const showBranding = branding.enabled && Boolean(branding.agencyName || branding.clientName || branding.agencyLogoData);
  const infoItems = [
    { label: "Page Type", value: reportV21.page_type || report.page_type || "Service Page" },
    { label: "GBP Status", value: labelize(reportV21.gbp_status.status) },
    { label: "Generated", value: formatDate(reportV21.generated_at) },
    { label: "Report ID", value: compactTextMiddle(reportV21.report_id || report.external_report_id || report.report_id, 30) },
  ];

  return (
    <View style={styles.headerCard}>
      <Text style={styles.eyebrow}>SearchTrust Trust Audit Report</Text>
      <Text style={styles.title}>Trust Audit Report</Text>
      <Text style={styles.sourceBadge}>{sourceLabel(normalized.source)}</Text>
      {showBranding && (
        <View style={styles.agencyPanel}>
          <View style={styles.agencyHeader}>
            {branding.agencyLogoData && <Image src={branding.agencyLogoData} style={styles.agencyLogo} />}
            <View><Text style={styles.agencyBadge}>Agency report</Text></View>
          </View>
          {branding.clientName && <Text style={styles.agencyTitle}>Prepared for {truncateText(branding.clientName, 90)}</Text>}
          {branding.agencyName && <Text style={styles.agencyText}>Prepared by {truncateText(branding.agencyName, 90)}</Text>}
          <Text style={styles.agencyText}>Trust framework by SearchTrust</Text>
          {branding.footerNote && <Text style={styles.agencyText}>{truncateText(branding.footerNote, 160)}</Text>}
        </View>
      )}
      <View style={styles.urlBox}>
        <Text style={styles.pageUrl}>{safeText(reportV21.analyzed_url || report.page_url)}</Text>
      </View>
      <View style={styles.metaGrid}>
        {infoItems.map((item, index) => (
          <View key={item.label} style={[styles.metaItem, index === infoItems.length - 1 ? styles.metaItemLast : {}]}>
            <Text style={styles.metaLabel}>{item.label}</Text>
            <Text style={styles.metaValue}>{safeText(item.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ExecutiveSummary({ reportV21 }: { reportV21: ReportV21 }) {
  return (
    <>
      <View style={styles.scoreRow}>
        <ScoreCard
          label="Trust Status"
          value={safeText(reportV21.overall_status.label)}
          level={reportV21.overall_status.level}
          description={reportV21.overall_status.explanation}
        />
        <ScoreCard
          label="Ranking Potential"
          value={safeText(reportV21.ranking_potential.label)}
          level={reportV21.ranking_potential.level}
          description={reportV21.ranking_potential.explanation}
        />
        <ScoreCard
          label="Risk Level"
          value={safeText(reportV21.risk_level.label)}
          level={reportV21.risk_level.level}
          description={reportV21.risk_level.explanation}
          isLast
        />
      </View>

      <Section title="Executive Summary">
        <View style={styles.statement}>
          <Text style={styles.cardTitle}>{safeText(reportV21.client_summary.title, "Client Summary")}</Text>
          <Text style={styles.bodyText}>{truncateText(reportV21.client_summary.plain_language_summary, 520)}</Text>
        </View>
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Field label="Primary Blocking Layer" value={`${displayLayer(reportV21.primary_blocking_layer.layer_key)} - ${safeText(reportV21.primary_blocking_layer.reason)}`} />
            <Field label="Why It Matters" value={reportV21.client_summary.why_it_matters} />
          </View>
          <View style={[styles.column, styles.columnLast]}>
            <Field label="First Priority" value={reportV21.client_summary.first_priority} />
            <Field label="Expected Change" value={reportV21.client_summary.expected_change} />
          </View>
        </View>
        <EvidenceSummary evidence={reportV21.primary_blocking_layer.evidence_items} limit={1} />
      </Section>
    </>
  );
}

function PageLevelSection({ reportV21 }: { reportV21: ReportV21 }) {
  return (
    <Section title="Page Level Assessment">
      <View style={styles.row}>
        <Text style={[styles.cardTitle, { marginBottom: 0, flex: 1 }]}>{safeText(reportV21.page_level.label)}</Text>
      </View>
      <Field label="What It Looks Like" value={reportV21.page_level.what_it_looks_like} maxLength={520} />
      <View style={styles.twoColumn}>
        <View style={styles.column}>
          <Text style={styles.label}>Strengths</Text>
          <BulletList items={reportV21.page_level.strengths} limit={5} />
        </View>
        <View style={[styles.column, styles.columnLast]}>
          <Text style={styles.label}>Missing Elements</Text>
          <BulletList items={reportV21.page_level.missing_elements} limit={5} />
        </View>
      </View>
    </Section>
  );
}

function KeyIssuesSection({ reportV21 }: { reportV21: ReportV21 }) {
  const issues = safeList(reportV21.key_issues).slice(0, 4);
  return (
    <Section title="Key Issues">
      {issues.length === 0 && <Text style={styles.bodyText}>No structured key issues were available for this report.</Text>}
      {issues.map((issue, index) => (
        <View key={issue.id || `${issue.issue_title}-${index}`} style={styles.card}>
          <View style={styles.row}>
            <Text style={[styles.cardTitle, { flex: 1, marginBottom: 0 }]}>{index + 1}. {truncateText(issue.issue_title, 120)}</Text>
            <StatusBadge value={issue.severity} />
          </View>
          <Field label="Affected Layer" value={displayLayer(issue.affected_layer)} maxLength={120} />
          <Field label="Explanation" value={issue.explanation} maxLength={360} />
          <Field label="Why It Matters" value={issue.why_it_matters} maxLength={280} />
          <EvidenceSummary evidence={issue.evidence_items} limit={1} />
          {safeList(issue.recommended_actions).slice(0, 2).map((action) => (
            <ActionCard key={action.id || action.task_title} action={action} compact />
          ))}
        </View>
      ))}
    </Section>
  );
}

function layerByKey(reportV21: ReportV21, layerKey: LayerKey): LayerFinding {
  const found = safeList(reportV21.layers).find((layer) => layer.layer_key === layerKey);
  if (found) return found;
  const config = getLayerDisplayConfig(layerKey);
  return {
    layer_id: REQUIRED_LAYER_KEYS.indexOf(layerKey) + 1,
    layer_key: layerKey,
    layer_name: config.name,
    layer_label: config.label,
    status: "not_checked",
    checked_rule_ids: [],
    triggered_rule_ids: [],
    summary: "This layer was not available in the report payload.",
    explanation: "The PDF renderer preserved the required layer order and marked this layer as not checked.",
    evidence_items: [],
    suggested_fixes: [],
    action_items: [],
  };
}

function TrustLayersSection({ reportV21 }: { reportV21: ReportV21 }) {
  return (
    <Section title="8-Layer Trust Model">
      <View style={styles.layerGrid}>
        {REQUIRED_LAYER_KEYS.map((layerKey, index) => {
          const layer = layerByKey(reportV21, layerKey);
          const config = getLayerDisplayConfig(layerKey);
          return (
            <View key={layerKey} style={[styles.layerCard, index % 2 === 1 ? styles.layerCardEven : {}]}>
              <View style={styles.layerHeader}>
                <Text style={styles.layerTitle}>{config.label}</Text>
                <StatusBadge value={layer.status} />
              </View>
              <Text style={styles.mutedText}>{config.name}</Text>
              <Field label="Assessment" value={layer.summary || layer.explanation} maxLength={230} />
              <Text style={styles.mutedText}>
                Signals assessed: {config.signalsAssessed} / Findings requiring attention: {safeList(layer.triggered_rule_ids).length}
              </Text>
              <View style={{ marginTop: 6 }}>
                <Text style={styles.label}>Top Suggested Fixes</Text>
                <BulletList items={layer.suggested_fixes} limit={1} maxLength={150} />
              </View>
            </View>
          );
        })}
      </View>
    </Section>
  );
}

function ActionSection({ title, actions, limit }: { title: string; actions?: ActionItem[]; limit?: number }) {
  const items = safeList(actions).slice(0, limit);
  if (!items.length) return null;
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.cardTitle}>{title}</Text>
      {items.map((action) => <ActionCard key={action.id || action.task_title} action={action} compact />)}
    </View>
  );
}

function OptimizationPathSection({ reportV21 }: { reportV21: ReportV21 }) {
  const path = reportV21.optimization_path;
  return (
    <Section title="Optimization Path">
      <ActionSection title="Must Execute Now" actions={path.must_execute_now} limit={4} />
      <ActionSection title="Address After the Foundation" actions={path.defer_until_later} limit={3} />
      <View style={styles.statement}>
        <Text style={styles.cardTitle}>Improvement Sequence</Text>
        <Text style={styles.bodyText}>L1-L3 establish a stable business entity. L4-L5 add local, real-world detail. L6-L7 add accountable, unique proof. L8 Algorithm Fit is reassessed after those earlier signals improve.</Text>
      </View>
      <Field label="Fix Order Warning" value={path.fix_order_warning} maxLength={360} />
      <Text style={styles.label}>Completion Signals</Text>
      <BulletList items={path.completion_signals} limit={5} />
    </Section>
  );
}

function coverageRows(reportV21: ReportV21): Array<[string, boolean]> {
  const coverage = reportV21.data_coverage;
  return [
    ["Page content", coverage.page_content_checked],
    ["GBP", coverage.gbp_checked],
    ["Schema", coverage.schema_checked],
    ["Contact page", coverage.contact_page_checked],
    ["About page", coverage.about_page_checked],
    ["Reviews", coverage.reviews_checked],
    ["Internal pages", coverage.internal_pages_checked],
    ["Competitor pages", coverage.competitor_pages_checked],
  ];
}

function DataCoverageSection({ reportV21 }: { reportV21: ReportV21 }) {
  const limitations = filterClientLimitations(reportV21.data_coverage.limitations);
  const finalLimitations = reportV21.gbp_status.status !== "checked"
    ? [UNVERIFIED_GBP_MESSAGE, ...limitations.filter((item) => item !== UNVERIFIED_GBP_MESSAGE)]
    : limitations;

  return (
    <Section title="Data Coverage">
      <View style={styles.layerGrid}>
        {coverageRows(reportV21).map(([label, checked], index) => (
          <View key={label} style={[styles.layerCard, index % 2 === 1 ? styles.layerCardEven : {}]}>
            <Text style={styles.label}>{label}</Text>
            <StatusBadge value={checked ? "checked" : "not_checked"} />
          </View>
        ))}
      </View>
      <Field label="GBP Status Reason" value={reportV21.gbp_status.reason} maxLength={260} />
      {finalLimitations.length > 0 && (
        <View style={{ marginTop: 4 }}>
          <Text style={styles.label}>Limitations</Text>
          <BulletList items={finalLimitations} limit={6} maxLength={220} />
        </View>
      )}
    </Section>
  );
}

function AlignmentTable({ rows }: { rows: GBPAlignmentRow[] }) {
  const visibleRows = rows.slice(0, 8);
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <View style={[styles.tableCell, { width: "18%" }]}><Text style={styles.tableHeadText}>Field</Text></View>
        <View style={[styles.tableCell, { width: "25%" }]}><Text style={styles.tableHeadText}>Page Signal</Text></View>
        <View style={[styles.tableCell, { width: "25%" }]}><Text style={styles.tableHeadText}>GBP Signal</Text></View>
        <View style={[styles.tableCell, { width: "14%" }]}><Text style={styles.tableHeadText}>Status</Text></View>
        <View style={[styles.tableCell, styles.tableCellLast, { width: "18%" }]}><Text style={styles.tableHeadText}>Suggested Fix</Text></View>
      </View>
      {visibleRows.map((row, index) => (
        <View key={`${row.field_key}-${index}`} style={[styles.tableRow, index === visibleRows.length - 1 ? styles.tableRowLast : {}]}>
          <View style={[styles.tableCell, { width: "18%" }]}><Text style={styles.tableText}>{truncateText(row.field_label, 45)}</Text></View>
          <View style={[styles.tableCell, { width: "25%" }]}><Text style={styles.tableText}>{truncateText(row.page_value, 90)}</Text></View>
          <View style={[styles.tableCell, { width: "25%" }]}><Text style={styles.tableText}>{truncateText(row.gbp_value, 90)}</Text></View>
          <View style={[styles.tableCell, { width: "14%" }]}><Text style={styles.tableText}>{labelize(row.status)}</Text></View>
          <View style={[styles.tableCell, styles.tableCellLast, { width: "18%" }]}><Text style={styles.tableText}>{truncateText(row.suggested_fix || row.impact, 100)}</Text></View>
        </View>
      ))}
    </View>
  );
}

function GBPAlignmentSection({ reportV21 }: { reportV21: ReportV21 }) {
  const alignment = extractGBPAlignmentRows(reportV21);

  if (reportV21.gbp_status.status !== "checked") {
    return (
      <Section title="GBP × Page Alignment">
        <View style={styles.statement}>
          <Text style={styles.bodyText}>{UNVERIFIED_GBP_MESSAGE}</Text>
        </View>
        <Field label="Reason" value={reportV21.gbp_status.reason} maxLength={260} />
      </Section>
    );
  }

  if (!alignment.rows.length) {
    return (
      <Section title="GBP × Page Alignment">
        <View style={styles.statement}>
          <Text style={styles.bodyText}>
            GBP was checked, but this report does not include a structured side-by-side GBP × Page alignment table.
          </Text>
        </View>
        <Text style={styles.mutedText}>
          Review L2 Entity Presence and L3 Entity Consistency for available evidence.
        </Text>
      </Section>
    );
  }

  return (
    <Section title="GBP × Page Alignment">
      <AlignmentTable rows={alignment.rows} />
    </Section>
  );
}

function MethodFooter() {
  return (
    <View style={styles.methodFooter}>
      <Text style={styles.bodyText}>
        This report evaluates checked trust signals and does not guarantee rankings or business outcomes.
      </Text>
      <Text style={styles.mutedText}>
        Data coverage reflects only the inputs available at analysis time.
      </Text>
    </View>
  );
}

export function ReportPDFDocument({ report, branding }: { report: Report; branding?: EffectiveBranding }) {
  const normalized = normalizeReportToV21(report);
  const reportV21 = normalized.reportV21;
  const reportId = reportV21.report_id || report.external_report_id || report.report_id;

  return (
    <Document title={`SearchTrust Report ${reportId}`} author="SearchTrust" subject="Trust Audit Report" creator="SearchTrust">
      <Page size="A4" style={styles.page} wrap>
        <ReportHeader report={report} reportV21={reportV21} normalized={normalized} brandingOverride={branding} />
        <ExecutiveSummary reportV21={reportV21} />
        <PageLevelSection reportV21={reportV21} />
        <KeyIssuesSection reportV21={reportV21} />
        <TrustLayersSection reportV21={reportV21} />
        <OptimizationPathSection reportV21={reportV21} />
        <DataCoverageSection reportV21={reportV21} />
        <GBPAlignmentSection reportV21={reportV21} />
        <MethodFooter />

        <View style={styles.fixedFooter} fixed>
          <Text>SearchTrust</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
