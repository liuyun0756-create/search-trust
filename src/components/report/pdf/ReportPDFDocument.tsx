import React from "react";
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  buildAuditWorkPhases,
  extractGBPAlignmentRows,
  formatWorkLayer,
  getClientDecisionContext,
  getDisplayLayerFinding,
  getDisplaySignalsAssessed,
  getEffectiveBranding,
  getLayerDisplayConfig,
  getAdditionalBusinessPresenceActions,
  getProposalActionDisplayCopy,
  getProposalOpportunityCopy,
  IMPROVEMENT_SEQUENCE,
  NO_ADDITIONAL_PROPOSAL_TASKS_MESSAGE,
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
  PdfVariant,
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
  medium_weak: "#2563EB",
  improvable: "#4F46E5",
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
  agencyPanel: {
    borderWidth: 1,
    borderColor: "#E4EDD2",
    borderRadius: 10,
    backgroundColor: "#FBFDF5",
    padding: 12,
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
    textTransform: "uppercase",
  },
  agencyRelationship: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 9,
  },
  agencyParty: {
    width: "49%",
    minHeight: 62,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E4EDD2",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  agencyPartyLast: {
    marginRight: 0,
  },
  agencyPartyOnly: {
    width: "100%",
    marginRight: 0,
  },
  agencyPartyCopy: {
    flex: 1,
  },
  agencyPartyLabel: {
    color: "#7A8A15",
    fontSize: 7,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  agencyPartyName: {
    color: "#111827",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  agencyNote: {
    color: "#4B5563",
    fontSize: 7.5,
    lineHeight: 1.35,
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: "#E4EDD2",
  },
  agencyLogo: {
    width: 38,
    height: 38,
    objectFit: "contain",
    marginRight: 10,
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
  decisionBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  priorityBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginBottom: 7,
    fontSize: 7,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  decisionDivider: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
  },
  metricRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    marginBottom: 10,
  },
  metricItem: {
    width: "33.333%",
    padding: 9,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  metricItemLast: {
    borderRightWidth: 0,
  },
  metricValue: {
    color: "#111827",
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 3,
  },
  approvalCard: {
    borderWidth: 1,
    borderColor: "#DCE8C3",
    backgroundColor: "#FBFDF6",
    borderRadius: 10,
    padding: 11,
    marginBottom: 10,
  },
  scoreInterpretation: {
    borderWidth: 1,
    borderColor: "#E0E7FF",
    backgroundColor: "#F5F7FF",
    borderRadius: 9,
    padding: 9,
    marginBottom: 10,
  },
  phaseList: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    marginBottom: 10,
  },
  phaseRow: {
    flexDirection: "row",
    padding: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F3",
  },
  phaseRowLast: {
    borderBottomWidth: 0,
  },
  phaseNumber: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#A5D020",
    color: "#1A212B",
    fontSize: 8,
    fontWeight: 700,
    textAlign: "center",
    paddingTop: 4,
    marginRight: 8,
  },
  phaseLabel: {
    width: 105,
    marginRight: 8,
  },
  sourceLine: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
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
      {!compact && safeList(action.addressed_findings).length > 0 && (
        <View style={{ marginBottom: 7 }}>
          <Text style={styles.label}>Addresses {safeList(action.addressed_findings).length} Findings</Text>
          <BulletList items={action.addressed_findings} maxLength={220} />
        </View>
      )}
      {!compact && safeList(action.required_changes).length > 0 && (
        <View style={{ marginBottom: 7 }}>
          <Text style={styles.label}>Required Changes</Text>
          <BulletList items={action.required_changes} maxLength={260} />
        </View>
      )}
      <Field label="Where To Add" value={safeList(action.where_to_add).join("; ")} maxLength={compact ? 160 : 260} />
      <Field label="What To Add" value={safeList(action.what_to_add).join("; ")} maxLength={compact ? 180 : 280} />
      {safeList(action.example_copy).length > 0 && (
        <View style={{ marginBottom: 7 }}>
          <Text style={styles.label}>Example Copy</Text>
          <BulletList items={action.example_copy} limit={compact ? 1 : 3} maxLength={compact ? 180 : 280} />
        </View>
      )}
      {!compact && <Field label="Expected Effect" value={action.expected_effect} maxLength={240} />}
      {!compact && safeList(action.implementation_notes).length > 0 && (
        <View style={{ marginBottom: 7 }}><Text style={styles.label}>Implementation Notes</Text><BulletList items={action.implementation_notes} maxLength={260} /></View>
      )}
      {!compact && safeList(action.completion_signals).length > 0 && (
        <View style={{ marginBottom: 7 }}><Text style={styles.label}>Completion Signals</Text><BulletList items={action.completion_signals} maxLength={260} /></View>
      )}
      <View style={styles.row}>
        <Text style={styles.mutedText}>Effort: {labelize(safeText(action.effort_level, "medium"))}</Text>
      </View>
    </View>
  );
}

function ReportHeader({
  report,
  reportV21,
  brandingOverride,
}: {
  report: Report;
  reportV21: ReportV21;
  brandingOverride?: EffectiveBranding;
}) {
  const branding = brandingOverride ?? getEffectiveBranding(reportV21);
  const showBranding = branding.enabled && Boolean(branding.agencyName || branding.clientName || branding.agencyLogoData);
  const hasAgencyIdentity = Boolean(branding.agencyName || branding.agencyLogoData);
  const hasClientIdentity = Boolean(branding.clientName);
  const isSampleReport = report.id === "sample-v21" || reportV21.report_id === "RPT-SAMPLE-001";
  const infoItems = [
    { label: "Page Type", value: reportV21.page_type || report.page_type || "Service Page" },
    { label: "GBP Status", value: labelize(reportV21.gbp_status.status) },
    { label: "Generated", value: formatDate(reportV21.generated_at) },
    { label: "Report ID", value: compactTextMiddle(reportV21.report_id || report.external_report_id || report.report_id, 30) },
  ];

  return (
    <View style={styles.headerCard}>
      <Text style={styles.title}>{isSampleReport ? "Trust Audit Report (Sample)" : "Trust Audit Report"}</Text>
      {showBranding && (
        <View style={styles.agencyPanel}>
          <Text style={styles.agencyBadge}>Agency report</Text>
          <View style={styles.agencyRelationship}>
            {hasAgencyIdentity && (
              <View style={[styles.agencyParty, !hasClientIdentity ? styles.agencyPartyOnly : {}]}>
                {branding.agencyLogoData && <Image src={branding.agencyLogoData} style={styles.agencyLogo} />}
                <View style={styles.agencyPartyCopy}>
                  <Text style={styles.agencyPartyLabel}>Prepared by agency</Text>
                  <Text style={styles.agencyPartyName}>
                    {truncateText(branding.agencyName || "Agency", 90)}
                  </Text>
                </View>
              </View>
            )}
            {hasClientIdentity && (
              <View style={[
                styles.agencyParty,
                styles.agencyPartyLast,
                !hasAgencyIdentity ? styles.agencyPartyOnly : {},
              ]}>
                <View style={styles.agencyPartyCopy}>
                  <Text style={styles.agencyPartyLabel}>Prepared for client</Text>
                  <Text style={styles.agencyPartyName}>{truncateText(branding.clientName, 90)}</Text>
                </View>
              </View>
            )}
          </View>
          {branding.footerNote && <Text style={styles.agencyNote}>{truncateText(branding.footerNote, 160)}</Text>}
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

function ExecutiveSummary({ reportV21, variant }: { reportV21: ReportV21; variant: PdfVariant }) {
  if (variant === "client") {
    return <ClientExecutiveSummary reportV21={reportV21} />;
  }

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

      <Section title="Overall Conclusion">
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
        {variant === "full" && <EvidenceSummary evidence={reportV21.primary_blocking_layer.evidence_items} limit={3} />}
      </Section>
    </>
  );
}

function ClientExecutiveSummary({ reportV21 }: { reportV21: ReportV21 }) {
  const summary = reportV21.client_summary;
  const decision = getClientDecisionContext(reportV21);
  const palette = decisionPalette(decision.priority_level);
  const sources = checkedDataSources(reportV21);
  const clientPhaseGroups = IMPROVEMENT_SEQUENCE
    .map((sequence) => ({
      sequence,
      items: decision.work_sequence.filter((item) => item.phase_number === sequence.number),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <Section title="Overall Conclusion">
        <View style={[styles.decisionBanner, { borderColor: palette.border, backgroundColor: palette.background }]}>
          <Text style={[styles.priorityBadge, { borderColor: palette.border, color: palette.text, backgroundColor: "#FFFFFF" }]}>
            {decision.priority_label}
          </Text>
          <Text style={styles.cardTitle}>{safeText(summary.title, "Client Summary")}</Text>
          <Text style={styles.bodyText}>{truncateText(summary.plain_language_summary, 520)}</Text>
          <View style={[styles.decisionDivider, { borderTopColor: palette.border }]}>
            <Text style={[styles.label, { color: palette.text }]}>Why action is needed now</Text>
            <Text style={styles.bodyText}>{truncateText(decision.why_act_now, 460)}</Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <DecisionMetric label="Confirmed findings" value={decision.issue_count} />
          <DecisionMetric label="Affected trust layers" value={decision.affected_layer_count} />
          <DecisionMetric label="Recommended focus areas" value={decision.work_phase_count} isLast />
        </View>

        <View style={styles.approvalCard}>
          <Text style={[styles.label, { color: "#7A991C" }]}>Recommended approval</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <Field
                label="Primary Blocking Layer"
                value={`${displayLayer(reportV21.primary_blocking_layer.layer_key)} - ${safeText(reportV21.primary_blocking_layer.reason)}`}
                maxLength={360}
              />
            </View>
            <View style={[styles.column, styles.columnLast]}>
              <Field label="First Priority" value={summary.first_priority} maxLength={300} />
              <Field label="Expected Change" value={summary.expected_change} maxLength={300} />
            </View>
          </View>
        </View>

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
        <View style={styles.scoreInterpretation}>
          <Text style={styles.bodyText}>{truncateText(decision.score_interpretation, 560)}</Text>
        </View>

        <Text style={styles.label}>Recommended work sequence</Text>
        {decision.work_sequence.length ? (
          <View style={styles.phaseList}>
            {clientPhaseGroups.map(({ sequence, items }, index) => (
              <View
                key={sequence.number}
                style={[styles.phaseRow, index === clientPhaseGroups.length - 1 ? styles.phaseRowLast : {}]}
                wrap={false}
              >
                <View style={styles.phaseLabel}>
                  <Text style={[styles.label, { color: "#7A991C" }]}>
                    Phase {sequence.number} · {sequence.layerRange}
                  </Text>
                  <Text style={styles.cardTitle}>{sequence.title}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  {items.map((item) => (
                    <View key={item.layer_keys.join("-")} style={{ marginBottom: 6 }}>
                      <Text style={styles.mutedText}>{item.layer_labels[0]}</Text>
                      <Text style={styles.bodyText}>{truncateText(item.summary, 260)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.softCard}>
            <Text style={styles.bodyText}>
              Maintain the current trust signals and re-audit after meaningful page or business changes.
            </Text>
          </View>
        )}
        <View style={styles.sourceLine}>
          <Text style={styles.mutedText}>
            Sources checked: {sources.length ? sources.join(", ") : "No structured data coverage was available."}
          </Text>
        </View>
      </Section>
    </>
  );
}

function DecisionMetric({ label, value, isLast = false }: { label: string; value: number; isLast?: boolean }) {
  return (
    <View style={[styles.metricItem, isLast ? styles.metricItemLast : {}]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

function decisionPalette(priority: "immediate" | "high" | "planned" | "monitor") {
  return {
    immediate: { border: "#FECACA", background: "#FFF7F7", text: "#B91C1C" },
    high: { border: "#FDE68A", background: "#FFFBEB", text: "#B45309" },
    planned: { border: "#BFDBFE", background: "#F5F9FF", text: "#1D4ED8" },
    monitor: { border: "#A7F3D0", background: "#F3FFF9", text: "#047857" },
  }[priority];
}

function checkedDataSources(reportV21: ReportV21): string[] {
  const coverage = reportV21.data_coverage;
  return [
    coverage?.page_content_checked && "Page content",
    coverage?.gbp_checked && "GBP",
    coverage?.schema_checked && "Schema",
    coverage?.contact_page_checked && "Contact page",
    coverage?.about_page_checked && "About page",
    coverage?.reviews_checked && "Reviews",
    coverage?.internal_pages_checked && "Internal pages",
  ].filter((item): item is string => Boolean(item));
}

function PageLevelSection({ reportV21 }: { reportV21: ReportV21 }) {
  const pageLevel = reportV21.page_level;
  return (
    <Section title="Page Level">
      <View style={styles.row}>
        <Text style={[styles.cardTitle, { marginBottom: 0, flex: 1 }]}>{safeText(pageLevel.label)}</Text>
      </View>
      <Field label="Current Assessment" value={pageLevel.current_assessment || pageLevel.what_it_looks_like} maxLength={520} />
      <View style={styles.twoColumn}>
        <View style={styles.column}>
          <Field label="Existing Foundation" value={pageLevel.existing_foundation || safeList(pageLevel.strengths).join(" ")} maxLength={320} />
        </View>
        <View style={[styles.column, styles.columnLast]}>
          <Field label="Main Limitation" value={pageLevel.main_limitation || safeList(pageLevel.missing_elements).join(" ")} maxLength={320} />
        </View>
      </View>
      <View style={styles.twoColumn}>
        <View style={styles.column}>
          <Field label="Likely Search Outcome" value={pageLevel.likely_search_outcome} maxLength={320} />
        </View>
        <View style={[styles.column, styles.columnLast]}>
          <Field label="Competitive Interpretation" value={pageLevel.competitive_interpretation} maxLength={320} />
        </View>
      </View>
    </Section>
  );
}

function KeyIssuesSection({ reportV21, variant }: { reportV21: ReportV21; variant: PdfVariant }) {
  const allIssues = safeList(reportV21.key_issues);
  const issues = variant === "client" ? allIssues.slice(0, 2) : allIssues;
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
          <Field label="Judgement" value={issue.judgement || issue.explanation} maxLength={320} />
          <Field label="Explanation" value={issue.explanation} maxLength={360} />
          <Field label="Why It Matters" value={issue.why_it_matters} maxLength={280} />
          {safeList(issue.impacts).length > 0 && (
            <View style={{ marginBottom: 6 }}>
              <Text style={styles.label}>Impacts</Text>
              <BulletList items={issue.impacts} limit={3} maxLength={180} />
            </View>
          )}
          {safeList(issue.suggestions).length > 0 && (
            <View style={{ marginBottom: 6 }}>
              <Text style={styles.label}>Suggestions</Text>
              <BulletList items={issue.suggestions} limit={3} maxLength={180} />
            </View>
          )}
          {variant === "full" && safeList(issue.recommended_actions).map((action) => (
            <ActionCard key={action.id || action.task_title} action={action} />
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

function TrustLayersSection({ reportV21, variant }: { reportV21: ReportV21; variant: PdfVariant }) {
  return (
    <Section title="Trust Layer Breakdown">
      <View style={styles.layerGrid}>
        {REQUIRED_LAYER_KEYS.map((layerKey, index) => {
          const layer = getDisplayLayerFinding(
            layerByKey(reportV21, layerKey),
            reportV21.gbp_status?.status,
          );
          const config = getLayerDisplayConfig(layerKey);
          const findingCount = safeList(layer.triggered_rule_ids).length;
          const presentationMode = layer.presentation_mode
            || (layer.status === "good"
              ? findingCount === 0 ? "healthy" : "healthy_with_opportunities"
              : "attention");
          const isHealthy = presentationMode === "healthy";
          const isHealthyWithOpportunities = presentationMode === "healthy_with_opportunities";
          return (
            <View key={layerKey} style={[styles.layerCard, index % 2 === 1 ? styles.layerCardEven : {}]}>
              <View style={styles.layerHeader}>
                <Text style={styles.layerTitle}>{config.label}</Text>
                <StatusBadge value={layer.status} />
              </View>
              {variant === "client" ? (
                <Text style={[styles.mutedText, { marginTop: 8 }]}>
                  Findings requiring attention: {findingCount}
                </Text>
              ) : (
                <>
                  <Text style={styles.mutedText}>{config.name}</Text>
                  <Field label="Assessment" value={layer.summary || layer.explanation} maxLength={230} />
                  <Text style={styles.mutedText}>
                    Signals assessed: {getDisplaySignalsAssessed(layer)} / {layer.status === "good" ? "Improvement opportunities" : "Findings requiring attention"}: {findingCount}
                  </Text>
                </>
              )}
              {variant === "full" && safeList(layer.triggered_findings).length > 0 && (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.label}>{isHealthyWithOpportunities ? "Opportunities To Strengthen" : "What Needs Attention"}</Text>
                  <BulletList items={layer.triggered_findings} maxLength={150} />
                </View>
              )}
              {variant === "full" && !isHealthy && safeList(layer.suggested_fixes).length > 0 && <View style={{ marginTop: 6 }}>
                <Text style={styles.label}>{isHealthyWithOpportunities ? "Recommended Enhancements" : "Suggested Fixes"}</Text>
                <BulletList items={layer.suggested_fixes} limit={3} maxLength={150} />
              </View>}
              {variant === "full" && <EvidenceSummary evidence={layer.evidence_items} limit={layer.evidence_items.length} />}
            </View>
          );
        })}
      </View>
    </Section>
  );
}

function ActionSection({ title, actions, limit, compact = false }: { title: string; actions?: ActionItem[]; limit?: number; compact?: boolean }) {
  const allItems = safeList(actions);
  const items = limit == null ? allItems : allItems.slice(0, limit);
  if (!items.length) return null;
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.cardTitle}>{title}</Text>
      {items.map((action) => <ActionCard key={action.id || action.task_title} action={action} compact={compact} />)}
    </View>
  );
}

function OptimizationPathSection({ reportV21, variant }: { reportV21: ReportV21; variant: PdfVariant }) {
  const allWorkPhases = buildAuditWorkPhases(reportV21);
  return (
    <Section title="Implementation Roadmap">
      <View style={styles.softCard}>
        {variant === "full" ? (
          <>
            <Text style={styles.cardTitle}>Improvement Sequence</Text>
            <Text style={styles.mutedText}>The fixed SearchTrust order for repairing trust signals. This is a method overview, not a progress control.</Text>
            <View style={[styles.layerGrid, { marginTop: 8 }]}>
              {IMPROVEMENT_SEQUENCE.map((phase, index) => (
                <View
                  key={phase.number}
                  style={[styles.layerCard, index % 2 === 1 ? styles.layerCardEven : {}, { backgroundColor: "#F8FAFC" }]}
                >
                  <Text style={styles.label}>Phase {phase.number} · {phase.layerRange}</Text>
                  <Text style={styles.cardTitle}>{phase.title}</Text>
                  <Text style={styles.mutedText}>{phase.detail}</Text>
                </View>
              ))}
            </View>

            <View style={{ marginTop: 4 }}>
            <Text style={styles.cardTitle}>Audit Work Plan</Text>
            {allWorkPhases.length ? allWorkPhases.map((phase) => (
              <View key={phase.number} style={{ marginTop: 6 }}>
                <Text style={styles.label}>Phase {phase.number} · {phase.layerRange} · {phase.title}</Text>
                {phase.affectedLayers.map((layerKey) => (
                  <View key={layerKey} style={{ marginTop: 3 }}>
                    <Text style={styles.mutedText}>{formatWorkLayer(layerKey)}</Text>
                    <BulletList
                      items={phase.actions
                        .filter((action) => action.affected_layer === layerKey)
                        .map((action) => `${action.task_title} (${action.priority})`)}
                      maxLength={150}
                    />
                  </View>
                ))}
              </View>
            )) : <Text style={styles.bodyText}>No remediation work was confirmed in this audit.</Text>}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>Recommended Implementation Plan</Text>
            <Text style={styles.mutedText}>
              These are the work phases confirmed by this audit. Detailed implementation tasks remain in the Full Trust Audit.
            </Text>
            {allWorkPhases.length ? (
              <View style={[styles.layerGrid, { marginTop: 8 }]}>
                {allWorkPhases.map((phase, index) => (
                  <View
                    key={phase.number}
                    style={[styles.layerCard, index % 2 === 1 ? styles.layerCardEven : {}, { backgroundColor: "#FBFDF6" }]}
                  >
                    <Text style={styles.label}>Phase {phase.number} · {phase.layerRange}</Text>
                    <Text style={styles.cardTitle}>{phase.title}</Text>
                    <Text style={styles.mutedText}>{phase.detail}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.bodyText}>No active implementation phase was confirmed in this audit.</Text>
            )}
          </>
        )}
      </View>

      {variant === "full" && (
        <View style={styles.statement}>
          <Text style={styles.cardTitle}>Completion, Observation &amp; Re-audit</Text>
          <Text style={styles.label}>Completion Gate</Text>
          <BulletList
            items={allWorkPhases.length
              ? allWorkPhases.map((phase) => `Phase ${phase.number}: ${phase.completionGate}`)
              : ["No active phase requires a completion gate."]}
            maxLength={210}
          />
          <Text style={[styles.label, { marginTop: 5 }]}>Observation Window</Text>
          <BulletList
            items={allWorkPhases.length
              ? allWorkPhases.map((phase) => `Phase ${phase.number}: ${phase.observationWindow}`)
              : ["Continue normal monitoring and reassess after meaningful page changes."]}
            maxLength={160}
          />
          <Text style={[styles.label, { marginTop: 5 }]}>Re-audit Checkpoint</Text>
          <BulletList
            items={[
              "Run a fresh full audit after the relevant observation window.",
              "Compare the new rule vector and layer statuses before closing the work.",
            ]}
            maxLength={180}
          />
          <Text style={[styles.mutedText, { marginTop: 5 }]}>
            Work on the next phase may begin immediately. The observation window indicates when search impact can be evaluated more reliably.
          </Text>
        </View>
      )}
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

function BusinessPresenceAuditSection({ reportV21, variant }: { reportV21: ReportV21; variant: PdfVariant }) {
  const audit = reportV21.business_presence_audit;
  if (!audit) {
    return (
      <>
        <DataCoverageSection reportV21={reportV21} />
        <GBPAlignmentSection reportV21={reportV21} />
      </>
    );
  }

  const alignment = extractGBPAlignmentRows(reportV21);
  const alignmentUnavailable = new Set(["not_checked", "not_applicable", "error"]);
  const alignmentAttention = new Set(["mismatch", "missing", "partial"]);
  const alignmentSummary = {
    assessed: alignment.rows.filter((row) => !alignmentUnavailable.has(row.status)).length,
    matched: alignment.rows.filter((row) => row.status === "match").length,
    issues: alignment.rows.filter((row) => alignmentAttention.has(row.status)).length,
    unavailable: alignment.rows.filter((row) => alignmentUnavailable.has(row.status)).length,
  };
  const visibleAlignment = variant === "client"
    ? alignment.rows.filter((row) => ["mismatch", "missing", "partial"].includes(row.status))
    : alignment.rows;
  const profile = audit.profile_activity;
  const reviews = audit.review_audit;
  const proposalActions = getAdditionalBusinessPresenceActions(audit.proposal_actions);
  const proposalOpportunityCopy = getProposalOpportunityCopy(proposalActions.length);
  const distribution = Object.entries(reviews.rating_distribution)
    .sort(([left], [right]) => Number(right) - Number(left))
    .map(([rating, count]) => `${rating}-star: ${count}`)
    .join(" / ");

  return (
    <Section title="Business Presence Audit">
      <View style={styles.statement}>
        <Text style={styles.label}>Executive Snapshot</Text>
        <Text style={styles.cardTitle}>{truncateText(proposalOpportunityCopy.headline, 160)}</Text>
        <Text style={styles.bodyText}>{truncateText(proposalOpportunityCopy.summary, 420)}</Text>
        <Text style={styles.bodyText}>
          {alignmentSummary.assessed} signals assessed / {alignmentSummary.matched} aligned / {alignmentSummary.issues} need attention / {alignmentSummary.unavailable} not assessed
        </Text>
        <Text style={styles.mutedText}>These objective checks do not change the eight-layer score.</Text>
      </View>

      <Text style={styles.cardTitle}>Proposal-ready tasks</Text>
      {proposalActions.length ? proposalActions.map((action) => {
        const copy = getProposalActionDisplayCopy(action);
        return (
          <View key={action.id} style={styles.softCard}>
            <View style={styles.row}>
              <Text style={[styles.cardTitle, { flex: 1, marginBottom: 0 }]}>{truncateText(copy.title, 140)}</Text>
              <StatusBadge value={action.priority} />
            </View>
            <Field label="Business Area" value={labelize(action.business_area)} />
            <Field label="Why This Task Matters" value={copy.rationale} maxLength={420} />
            <Text style={styles.label}>What the Agency Should Deliver</Text>
            <BulletList items={copy.recommended_scope} maxLength={300} />
            {variant === "full" && <Field label="Evidence References" value={action.evidence_keys.join(", ")} maxLength={220} />}
          </View>
        );
      }) : <Text style={styles.mutedText}>{NO_ADDITIONAL_PROPOSAL_TASKS_MESSAGE}</Text>}

      {visibleAlignment.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.cardTitle}>GBP x Page Alignment</Text>
          <AlignmentTable rows={visibleAlignment} />
        </View>
      )}
      {variant === "client" && visibleAlignment.length === 0 && (
        <View style={styles.statement}><Text style={styles.bodyText}>No confirmed page-to-GBP alignment issue was found in the assessed signals.</Text></View>
      )}

      <View style={styles.layerGrid}>
        <View style={styles.layerCard}>
          <Text style={styles.cardTitle}>Profile Activity</Text>
          <Field label="Observed Categories" value={profile.categories.join(", ") || "Not returned"} maxLength={180} />
          <Field label="Photos Returned" value={profile.photo_count == null ? "Not returned" : String(profile.photo_count)} />
          <Field label="Latest Photo Date" value={profile.latest_photo_date || "Not exposed"} />
          <Field label="Posts Returned" value={profile.post_count == null ? "Not returned" : String(profile.post_count)} />
          <Field label="Latest Post Date" value={profile.latest_post_date || "Not exposed"} />
          {variant === "full" && <BulletList items={profile.limitations} maxLength={180} />}
        </View>
        <View style={[styles.layerCard, styles.layerCardEven]}>
          <Text style={styles.cardTitle}>Review Operations</Text>
          <Field label="GBP Review Total" value={reviews.total_reviews == null ? "Not returned" : String(reviews.total_reviews)} />
          <Field label="Recent Sample" value={`${reviews.sample_size} / ${reviews.sample_limit}`} />
          <Field label="Latest Review" value={reviews.latest_review_date || "Not returned"} />
          <Field label="Owner Reply Rate" value={reviews.owner_reply_rate == null ? "Not available" : `${Math.round(reviews.owner_reply_rate * 100)}%`} />
          <Field label="Unanswered Reviews" value={reviews.unanswered_count == null ? "Not available" : String(reviews.unanswered_count)} />
          <Field label="1-3 Star Reviews" value={reviews.low_rating_count == null ? "Not available" : String(reviews.low_rating_count)} />
          <Field label="1-3 Star Unanswered" value={reviews.low_rating_unanswered_count == null ? "Not available" : String(reviews.low_rating_unanswered_count)} />
          <Field label="Detailed Positive Reviews" value={reviews.detailed_positive_count == null ? "Not available" : String(reviews.detailed_positive_count)} />
          <Field label="Rating Distribution" value={distribution || "Not available"} maxLength={160} />
          {variant === "full" && <BulletList items={reviews.limitations} maxLength={180} />}
        </View>
      </View>

      {variant === "full" && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.cardTitle}>Audit Coverage</Text>
          <View style={styles.layerGrid}>
            {audit.audit_scope.map((item, index) => (
              <View key={item.key} style={[styles.layerCard, index % 2 === 1 ? styles.layerCardEven : {}]}>
                <Text style={styles.label}>{item.label}</Text>
                <StatusBadge value={item.status} />
                <Text style={styles.mutedText}>{truncateText(item.detail, 180)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {variant === "full" && reviews.reviews.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.cardTitle}>Recent Review Evidence ({reviews.reviews.length})</Text>
          {reviews.reviews.map((review, index) => (
            <View key={`${review.author || "review"}-${index}`} style={styles.card}>
              <Text style={styles.label}>
                {review.author || "Anonymous"} / {review.rating == null ? "No rating" : `${review.rating}/5`} / {review.date || "Date not returned"}
              </Text>
              <Text style={styles.bodyText}>{truncateText(review.text || "No review text returned", 600)}</Text>
              {review.owner_reply && <Text style={styles.mutedText}>Owner reply: {truncateText(review.owner_reply, 400)}</Text>}
            </View>
          ))}
        </View>
      )}
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

export function ReportPDFDocument({
  report,
  branding,
  variant = "full",
}: {
  report: Report;
  branding?: EffectiveBranding;
  variant?: PdfVariant;
}) {
  const normalized = normalizeReportToV21(report);
  const reportV21 = normalized.reportV21;
  const reportId = reportV21.report_id || report.external_report_id || report.report_id;

  return (
    <Document title={`SearchTrust Report ${reportId}`} author="SearchTrust" subject="Trust Audit Report" creator="SearchTrust">
      <Page size="A4" style={styles.page} wrap>
        <ReportHeader report={report} reportV21={reportV21} brandingOverride={branding} />
        <ExecutiveSummary reportV21={reportV21} variant={variant} />
        <PageLevelSection reportV21={reportV21} />
        {variant === "full" && <KeyIssuesSection reportV21={reportV21} variant={variant} />}
        <TrustLayersSection reportV21={reportV21} variant={variant} />
        <OptimizationPathSection reportV21={reportV21} variant={variant} />
        {variant === "full" && <BusinessPresenceAuditSection reportV21={reportV21} variant={variant} />}
        {variant === "full" && <MethodFooter />}

        <View style={styles.fixedFooter} fixed>
          <Text>SearchTrust</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
