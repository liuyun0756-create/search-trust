import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Report } from "@/types/database";

type ScoreCard = {
  label: string;
  value: string;
  description?: string;
  color: string;
};

const STATUS_COLORS: Record<string, string> = {
  High: "#22C55E",
  Strong: "#22C55E",
  Low: "#EF4444",
  Weak: "#EF4444",
  Medium: "#3B82F6",
  Moderate: "#8DBB16",
  "Medium-High": "#EF4444",
  "Medium-Low": "#F59E0B",
  Good: "#22C55E",
  Fair: "#F59E0B",
};

const styles = StyleSheet.create({
  page: {
    padding: 26,
    fontSize: 10,
    color: "#1A212B",
    fontFamily: "Helvetica",
    backgroundColor: "#F8F9FA",
  },
  headerCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: -0.4,
  },
  beta: {
    marginLeft: 8,
    backgroundColor: "#EFF8D8",
    color: "#8DBB16",
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: 8,
    fontWeight: 700,
  },
  pageUrl: {
    color: "#1D73FF",
    fontSize: 11,
    fontWeight: 700,
  },
  urlBox: {
    borderWidth: 1,
    borderColor: "#A5D020",
    backgroundColor: "#FBFFF1",
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  infoGrid: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    overflow: "hidden",
  },
  infoItem: {
    width: "25%",
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  infoItemLast: {
    borderRightWidth: 0,
  },
  infoIcon: {
    width: 18,
    height: 18,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
    marginBottom: 7,
  },
  infoLabel: {
    color: "#8A96A8",
    fontSize: 7.5,
    fontWeight: 700,
    marginBottom: 4,
  },
  infoValue: {
    color: "#1A212B",
    fontSize: 8.5,
    fontWeight: 700,
  },
  bodyText: {
    color: "#4B5563",
    fontSize: 10,
    lineHeight: 1.45,
  },
  scoreRow: {
    flexDirection: "row",
    marginBottom: 18,
  },
  scoreCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 13,
    width: "32%",
    minHeight: 112,
    marginRight: 7,
  },
  scoreTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },
  scoreIcon: {
    width: 18,
    height: 18,
    borderRadius: 8,
    marginRight: 7,
  },
  scoreLabel: {
    color: "#1A1F2B",
    fontSize: 9,
    fontWeight: 700,
    flex: 1,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8,
    lineHeight: 1.15,
  },
  scoreDesc: {
    color: "#465264",
    fontSize: 8,
    lineHeight: 1.45,
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    marginBottom: 18,
    overflow: "hidden",
  },
  sectionHeader: {
    backgroundColor: "#F8FAF5",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F3",
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionAccent: {
    width: 5,
    height: 20,
    borderRadius: 4,
    backgroundColor: "#A5D020",
    marginRight: 10,
  },
  sectionBody: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  statement: {
    backgroundColor: "#F3F8FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  statementText: {
    color: "#374151",
    fontSize: 11,
    lineHeight: 1.5,
  },
  label: {
    color: "#6B7280",
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 4,
  },
  inlineMetric: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    marginRight: 6,
  },
  metricLabel: {
    color: "#6B7280",
    fontSize: 10,
    marginRight: 5,
  },
  metricValue: {
    fontSize: 10,
    fontWeight: 700,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  miniCard: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 12,
    padding: 12,
    width: "48%",
    marginRight: 8,
    marginBottom: 8,
  },
  miniTitle: {
    color: "#4B5563",
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  block: {
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  stepCard: {
    borderWidth: 1,
    borderColor: "#E4EDD2",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  stepHeader: {
    borderWidth: 1,
    borderColor: "#E8F1D6",
    backgroundColor: "#F8FAF2",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 24,
    backgroundColor: "#A5D020",
    color: "#1A212B",
    fontSize: 10,
    fontWeight: 700,
    textAlign: "center",
    paddingTop: 6,
    marginRight: 9,
  },
  stepEyebrow: {
    color: "#8BAA2B",
    fontSize: 7.5,
    fontWeight: 700,
    marginBottom: 3,
  },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  numberBadge: {
    width: 18,
    height: 18,
    borderRadius: 18,
    backgroundColor: "#1D2531",
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: 700,
    textAlign: "center",
    paddingTop: 4,
    marginRight: 8,
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: 700,
  },
  subTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 5,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F3",
    marginVertical: 10,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 5,
  },
  bulletMark: {
    width: 10,
    color: "#8DBB16",
    fontSize: 10,
  },
  redBullet: {
    width: 10,
    color: "#EF4444",
    fontSize: 10,
  },
  tag: {
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 8.5,
    fontWeight: 700,
  },
  layerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    borderTopWidth: 1,
    borderTopColor: "#E8EAEE",
    paddingTop: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#9CA3AF",
    fontSize: 8,
  },
});

function getStatusColor(value?: string) {
  return STATUS_COLORS[value || ""] || "#3B82F6";
}

function parseScore(raw: string | null | undefined, fallbackLabel: string, fallbackColor: string): ScoreCard {
  if (!raw) return { label: fallbackLabel, value: "-", color: fallbackColor };
  try {
    const parsed = JSON.parse(raw);
    const value = parsed.value || "-";
    return {
      label: parsed.label || fallbackLabel,
      value,
      description: parsed.description || "",
      color: getStatusColor(value) || fallbackColor,
    };
  } catch {
    return { label: fallbackLabel, value: raw, color: fallbackColor };
  }
}

function text(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function formatGeneratedAt(report: Report) {
  if (report.generated_at) return report.generated_at;
  if (!report.created_at) return "";
  return new Date(report.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function BulletList({ items, tone = "green" }: { items?: unknown[]; tone?: "green" | "red" | "gray" }) {
  if (!items?.length) return null;
  const markStyle = tone === "red" ? styles.redBullet : styles.bulletMark;
  return (
    <View>
      {items.map((item, index) => (
        <View key={index} style={styles.bullet}>
          <Text style={markStyle}>•</Text>
          <Text style={[styles.bodyText, { flex: 1 }]}>{text(item)}</Text>
        </View>
      ))}
    </View>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === "") return null;
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.bodyText}>{text(value)}</Text>
    </View>
  );
}

function MiniCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniTitle}>{title}</Text>
      {typeof children === "string" ? <Text style={styles.bodyText}>{children}</Text> : children}
    </View>
  );
}

function NumberedBlock({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <Text style={styles.numberBadge}>{number}</Text>
        <Text style={styles.blockTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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

function StepCard({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepBadge}>{number}</Text>
        <View>
          <Text style={styles.stepEyebrow}>STEP {number}</Text>
          <Text style={styles.blockTitle}>{title}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function GenericObject({ data }: { data: Record<string, unknown> }) {
  return (
    <View>
      {Object.entries(data).map(([key, value]) => {
        if (value == null || value === "") return null;
        if (Array.isArray(value)) {
          return (
            <View key={key} style={{ marginBottom: 8 }}>
              <Text style={styles.label}>{key.replace(/_/g, " ").toUpperCase()}</Text>
              <BulletList items={value} />
            </View>
          );
        }
        if (typeof value === "object") {
          return (
            <View key={key} style={styles.block}>
              <Text style={styles.blockTitle}>{key.replace(/_/g, " ")}</Text>
              <GenericObject data={value as Record<string, unknown>} />
            </View>
          );
        }
        return <Field key={key} label={key.replace(/_/g, " ")} value={value} />;
      })}
    </View>
  );
}

function Module1({ data }: { data: Record<string, any> }) {
  const metrics = [
    ["Current Status", data.current_status],
    ["Ranking Potential", data.ranking_potential],
    ["Risk Level", data.risk_level],
  ];
  return (
    <Section title="Executive Summary">
      <Field label="Primary Blocking Layer" value={data.primary_blocking_layer} />
      {data.main_conclusion && (
        <View style={styles.statement}>
          <Text style={styles.statementText}>{data.main_conclusion}</Text>
        </View>
      )}
      {metrics.map(([label, value]) => value && (
        <View key={label} style={styles.inlineMetric}>
          <View style={[styles.dot, { backgroundColor: getStatusColor(value) }]} />
          <Text style={styles.metricLabel}>{label}:</Text>
          <Text style={[styles.metricValue, { color: getStatusColor(value) }]}>{value}</Text>
        </View>
      ))}
      <Field label="Explanation" value={data.explanation} />
    </Section>
  );
}

function Module2({ data }: { data: Record<string, any> }) {
  const cards = [
    ["Existing Foundation", data.existing_foundation],
    ["Main Limitation", data.main_limitation],
    ["Likely Search Outcome", data.likely_search_outcome],
    ["Competitive Interpretation", data.competitive_interpretation],
  ];
  return (
    <Section title="Page Level">
      <Field label="Current Assessment" value={data.current_assessment} />
      <View style={styles.cardGrid}>
        {cards.map(([label, value]) => value && (
          <MiniCard key={label} title={label}>{text(value)}</MiniCard>
        ))}
      </View>
    </Section>
  );
}

function Module3({ data }: { data: Record<string, any> }) {
  const failure = data.primary_trust_failure;
  const issues: any[] = data.concrete_issues || [];
  return (
    <Section title="Key Issues">
      <Text style={[styles.bodyText, { marginBottom: 12 }]}>
        Trust builds sequentially. Fixing the wrong layer first will limit the effectiveness of all subsequent work.
      </Text>
      {failure && (
        <NumberedBlock number={1} title="Primary Trust Failure">
          <Field label="Current Main Blockage Layer" value={failure.blocking_layer} />
          <Text style={styles.bodyText}>{text(failure.description)}</Text>
        </NumberedBlock>
      )}
      {issues.length > 0 && (
        <NumberedBlock number={2} title="Concrete Issues">
          {issues.map((issue, index) => (
            <View key={index}>
              <Text style={styles.subTitle}>{index + 1}. {text(issue.title)}</Text>
              <Field label="Judgement" value={issue.judgement} />
              <Field label="Explanation" value={issue.explanation} />
              {issue.impacts?.length > 0 && (
                <View style={{ marginBottom: 7 }}>
                  <Text style={styles.label}>Impacts</Text>
                  <BulletList items={issue.impacts} tone="red" />
                </View>
              )}
              {issue.suggestions?.length > 0 && (
                <View>
                  <Text style={styles.label}>Suggestions</Text>
                  <BulletList items={issue.suggestions} />
                </View>
              )}
              {index < issues.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </NumberedBlock>
      )}
    </Section>
  );
}

function Module4({ data }: { data: Record<string, any> }) {
  const layers: any[] = data.layers || [];
  const visibleLayers = layers
    .map((layer, index) => ({ ...layer, originalIndex: index }))
    .filter((layer) => layer.originalIndex !== 1 && layer.originalIndex !== 2);
  const layerTitles: Record<number, string> = {
    0: "L0-Relevance",
    3: "L1-Entity Clarity",
    4: "L2-Proof Signals",
    5: "L3-Local Fit",
    6: "L4-Strutural Trust",
    7: "L5-Standalone Value",
  };

  return (
    <Section title="Six-Layer Model">
      <Text style={[styles.bodyText, { marginBottom: 12 }]}>
        Below is the full six-layer trust diagnosis used to interpret the current strength of the page.
      </Text>
      <View style={styles.cardGrid}>
        {visibleLayers.map((layer, index) => (
          <View key={index} style={styles.miniCard}>
            <View style={styles.layerHeader}>
              <Text style={[styles.miniTitle, { width: "70%" }]}>
                {layerTitles[layer.originalIndex] || `Layer ${layer.originalIndex + 1}: ${text(layer.layer_name)}`}
              </Text>
              <Text style={[styles.tag, { backgroundColor: "#F5F7FA", color: getStatusColor(layer.status) }]}>
                {text(layer.status)}
              </Text>
            </View>
            <Text style={styles.bodyText}>{text(layer.description)}</Text>
          </View>
        ))}
      </View>
      {visibleLayers.length === 0 && <GenericObject data={data} />}
    </Section>
  );
}

function Module5({ data }: { data: Record<string, any> }) {
  const blocker = data.primary_trust_blocker;
  const mustItems: any[] = data.must_execute_now?.items || [];
  const roadmap: any[] = data.roadmap || [];
  const fixWarning = data.if_fix_order_is_wrong;
  const expect30 = data.what_to_expect_30_days;

  return (
    <Section title="Optimization Path">
      {blocker && (
        <StepCard number={1} title="Primary Trust Blocker">
          <Field label="Current Blocking Layer" value={blocker.blocking_layer} />
          <Field label="Summary" value={blocker.summary} />
          <Text style={styles.label}>Direct Consequences</Text>
          <BulletList items={blocker.direct_consequences} tone="red" />
          <Field label="Why This Layer Cannot Be Skipped" value={blocker.why_cannot_skip} />
        </StepCard>
      )}
      {mustItems.length > 0 && (
        <StepCard number={2} title="Must Execute Now">
          {mustItems.map((item, index) => (
            <View key={index}>
              <Text style={styles.subTitle}>Must Fix {index + 1} - {text(item.title)}</Text>
              <Field label="Why Now" value={item.why_now} />
              <Text style={styles.label}>Execution Focus</Text>
              <BulletList items={item.execution_focus} />
              <Text style={styles.label}>Completion Signals</Text>
              <BulletList items={item.completion_signals} />
              <Text style={styles.label}>Expected Impact</Text>
              <BulletList items={item.expected_impact} />
              {index < mustItems.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </StepCard>
      )}
      {roadmap.length > 0 && (
        <StepCard number={3} title="Roadmap">
          {roadmap.map((phase, index) => (
            <View key={index}>
              <Text style={styles.subTitle}>Phase {index + 1} - {text(phase.phase_title)}</Text>
              <Field label="Entry Condition" value={phase.entry_condition} />
              <Field label="Goal" value={phase.goal} />
              <Text style={styles.label}>Key Actions</Text>
              <BulletList items={phase.key_actions} />
              <Text style={styles.label}>Expected Outcomes</Text>
              <BulletList items={phase.expected_outcomes} />
              {index < roadmap.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </StepCard>
      )}
      {fixWarning && (
        <StepCard number={4} title={text(fixWarning.title) || "If Fix Order Is Wrong"}>
          <Field label="Intro" value={fixWarning.intro} />
          <Field label="Page Specific Risk" value={fixWarning.page_specific_risk} />
          <Field label="Closing Warning" value={fixWarning.closing_warning} />
        </StepCard>
      )}
      {expect30 && (
        <StepCard number={5} title={text(expect30.title) || "What To Expect In The Next 30 Days"}>
          <Field label="Intro" value={expect30.intro} />
          <Text style={styles.label}>Week 1-2</Text>
          <BulletList items={expect30.week_1_2} tone="gray" />
          <Text style={styles.label}>Week 2-3</Text>
          <BulletList items={expect30.week_2_3} tone="gray" />
          <Text style={styles.label}>Week 3-4</Text>
          <BulletList items={expect30.week_3_4} tone="gray" />
          <Text style={styles.label}>End Of 30 Days</Text>
          <BulletList items={expect30.end_of_30_days} tone="gray" />
          <Field label="Closing Note" value={expect30.closing_note} />
        </StepCard>
      )}
    </Section>
  );
}

function ReportSections({ report }: { report: Report }) {
  return (
    <>
      {report.module_1_overview && <Module1 data={report.module_1_overview} />}
      {report.module_2_page_level && <Module2 data={report.module_2_page_level} />}
      {report.module_3_key_problems && <Module3 data={report.module_3_key_problems} />}
      {report.module_4_eight_layers && <Module4 data={report.module_4_eight_layers} />}
      {report.module_5_optimization && <Module5 data={report.module_5_optimization} />}
    </>
  );
}

export function ReportPDFDocument({ report }: { report: Report }) {
  const reportId = report.external_report_id || report.report_id;
  const generatedAt = formatGeneratedAt(report);
  const infoItems = [
    { label: "Page Type", value: report.page_type || "Service Page", color: "#3B82F6" },
    { label: "GBP URL Status", value: report.gbp_url ? "Connected" : "Not provided", color: report.gbp_url ? "#22C55E" : "#6B7280" },
    { label: "Generated", value: generatedAt || "-", color: "#1A212B" },
    { label: "Report ID", value: reportId, color: "#1A212B" },
  ];
  const scoreCards = [
    parseScore(report.trust_status, "Trust Status", "#3B82F6"),
    parseScore(report.ranking_potential, "Ranking Potential", "#8DBB16"),
    parseScore(report.risk_level, "Risk Level", "#EF4444"),
  ];

  return (
    <Document title={`SearchTrust Report ${reportId}`} author="SearchTrust" subject="Trust Audit Report" creator="SearchTrust">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerCard}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Trust Audit Report</Text>
            <Text style={styles.beta}>BETA</Text>
          </View>

          <View style={styles.urlBox}>
            <Text style={styles.pageUrl}>{report.page_url}</Text>
          </View>

          <View style={styles.infoGrid}>
            {infoItems.map((item, index) => (
              <View
                key={item.label}
                style={[
                  styles.infoItem,
                  index === infoItems.length - 1 ? styles.infoItemLast : {},
                ]}
              >
                <View style={[styles.infoIcon, { backgroundColor: index === 1 ? "#ECFDF5" : "#EFF6FF" }]} />
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={[styles.infoValue, { color: item.color }]}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.scoreRow}>
          {scoreCards.map((card, index) => (
            <View
              key={card.label}
              style={[
                styles.scoreCard,
                index === scoreCards.length - 1 ? { marginRight: 0 } : {},
              ]}
            >
              <View style={styles.scoreTopRow}>
                <View style={[styles.scoreIcon, { backgroundColor: index === 2 ? "#FEF2F2" : index === 1 ? "#EEF2FF" : "#EFF6FF" }]} />
                <Text style={styles.scoreLabel}>{card.label}</Text>
              </View>
              <Text style={[styles.scoreValue, { color: card.color }]}>{card.value}</Text>
              {card.description && <Text style={styles.scoreDesc}>{card.description}</Text>}
            </View>
          ))}
        </View>

        <ReportSections report={report} />

        <View style={styles.footer} fixed>
          <Text>SearchTrust</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
