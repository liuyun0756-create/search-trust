import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { ReportV22ViewModel } from "@/lib/report-v22/view-model";
import type { EffectiveBranding } from "@/lib/report-v21";

const C = {
  ink: "#172019",
  muted: "#667166",
  paper: "#F6F3EA",
  white: "#FFFFFF",
  lime: "#A5D020",
  pale: "#EDF3E2",
  line: "#DDE3D8",
  warning: "#9B5C22",
};

const styles = StyleSheet.create({
  page: { backgroundColor: C.paper, color: C.ink, fontFamily: "Helvetica", fontSize: 9, padding: 38, paddingBottom: 54 },
  cover: { backgroundColor: C.ink, color: C.white, fontFamily: "Helvetica", padding: 44 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { width: 88, maxHeight: 38, objectFit: "contain" },
  badge: { color: C.lime, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1.6, textTransform: "uppercase" },
  coverBody: { marginTop: 118 },
  coverTitle: { fontSize: 36, lineHeight: 0.98, fontFamily: "Helvetica-Bold", letterSpacing: -1.5, maxWidth: 450 },
  coverMeta: { flexDirection: "row", marginTop: 22 },
  pill: { border: "1 solid #485349", borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10, marginRight: 7, color: "#DDE5DB", fontSize: 8 },
  coverDecision: { marginTop: 82, borderTop: "1 solid #485349", paddingTop: 22 },
  coverLabel: { color: C.lime, fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1.4, textTransform: "uppercase" },
  coverDecisionText: { marginTop: 9, color: C.white, fontSize: 15, lineHeight: 1.35, maxWidth: 470, fontFamily: "Helvetica-Bold" },
  agencyPanel: { marginTop: 28, borderRadius: 10, backgroundColor: "#232F26", padding: 14, flexDirection: "row", alignItems: "center" },
  agencyCopy: { marginLeft: 12 },
  agencyName: { color: C.white, fontFamily: "Helvetica-Bold", fontSize: 11 },
  agencyClient: { color: "#AEB8AD", marginTop: 3, fontSize: 8 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderBottom: `1 solid ${C.line}`, paddingBottom: 12, marginBottom: 24 },
  headerTitle: { fontFamily: "Helvetica-Bold", fontSize: 13 },
  headerMeta: { color: C.muted, fontSize: 7 },
  eyebrow: { color: "#78931C", fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 7 },
  title: { fontSize: 23, lineHeight: 1.08, fontFamily: "Helvetica-Bold", letterSpacing: -0.8, marginBottom: 16 },
  lead: { color: C.muted, fontSize: 10, lineHeight: 1.55, marginBottom: 18 },
  darkCard: { backgroundColor: C.ink, borderRadius: 12, padding: 20, color: C.white, marginBottom: 22 },
  darkTitle: { color: C.lime, fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1.3, textTransform: "uppercase" },
  darkBody: { marginTop: 10, height: 42, fontFamily: "Helvetica-Bold", fontSize: 14, lineHeight: 1.32 },
  darkFoot: { marginTop: 12, color: "#BFC7BE", fontSize: 9, lineHeight: 1.5 },
  grid3: { flexDirection: "row", marginHorizontal: -4, marginBottom: 20 },
  third: { width: "33.333%", paddingHorizontal: 4 },
  card: { border: `1 solid ${C.line}`, borderRadius: 9, backgroundColor: C.white, padding: 12, height: 125 },
  cardKicker: { color: "#78931C", fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1 },
  cardTitle: { marginTop: 6, fontFamily: "Helvetica-Bold", fontSize: 11, lineHeight: 1.3 },
  body: { marginTop: 6, color: C.muted, fontSize: 8, lineHeight: 1.45 },
  listItem: { flexDirection: "row", marginTop: 5 },
  bullet: { width: 10, color: "#78931C", fontFamily: "Helvetica-Bold" },
  listText: { flex: 1, color: C.muted, fontSize: 8, lineHeight: 1.4 },
  action: { border: `1 solid ${C.line}`, borderRadius: 10, backgroundColor: C.white, padding: 15, marginBottom: 10 },
  actionRow: { flexDirection: "row" },
  actionNumber: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.ink, color: C.lime, fontFamily: "Helvetica-Bold", fontSize: 13, textAlign: "center", paddingTop: 10, marginRight: 12 },
  actionCopy: { flex: 1 },
  actionTitle: { height: 34, fontFamily: "Helvetica-Bold", fontSize: 11, lineHeight: 1.35 },
  actionMeta: { marginTop: 5, color: C.muted, fontSize: 7.5 },
  section: { marginTop: 20 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 15, marginBottom: 10 },
  layerGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  layer: { width: "25%", paddingHorizontal: 4, marginBottom: 8 },
  layerInner: { minHeight: 90, border: `1 solid ${C.line}`, borderRadius: 8, padding: 9, backgroundColor: C.white },
  status: { marginTop: 8, fontSize: 6.5, color: "#78931C", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  finding: { borderLeft: `3 solid ${C.lime}`, backgroundColor: C.white, padding: 11, marginBottom: 8 },
  findingMeta: { color: C.muted, fontSize: 6.5, marginTop: 5 },
  limitation: { border: "1 solid #E8D8C5", backgroundColor: "#FFF8EE", borderRadius: 8, padding: 10, marginBottom: 7, color: C.warning, lineHeight: 1.45 },
  footer: { position: "absolute", bottom: 22, left: 38, right: 38, borderTop: `1 solid ${C.line}`, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", color: "#879087", fontSize: 6.5 },
});

function clean(value: string) {
  return value
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

function PdfFooter({ note }: { note?: string | null }) {
  return <View style={styles.footer} fixed><Text>{clean(note || "SearchTrust evidence-backed local search report")}</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>;
}

function Bullets({ items }: { items: string[] }) {
  return <>{items.map((item) => <View key={item} style={styles.listItem}><Text style={styles.bullet}>+</Text><Text style={styles.listText}>{clean(item)}</Text></View>)}</>;
}

function PageHeader({ report, label }: { report: ReportV22ViewModel; label: string }) {
  return <View style={styles.header}><Text style={styles.headerTitle}>{clean(report.header.businessName)}</Text><Text style={styles.headerMeta}>{label}  |  v{report.header.versionNumber}  |  {report.mode}</Text></View>;
}

export function ReportV22PDFDocument({ report, branding }: { report: ReportV22ViewModel; branding?: EffectiveBranding }) {
  const showBranding = Boolean(branding?.enabled && (branding.agencyName || branding.clientName || branding.agencyLogoData));
  return (
    <Document title={`SearchTrust - ${report.header.businessName}`} author={branding?.agencyName || "SearchTrust"} subject="Local search intelligence report">
      <Page size="A4" style={styles.cover}>
        <View style={styles.brandRow}><Text style={styles.badge}>SearchTrust intelligence report</Text><Text style={{ color: "#899389", fontSize: 8 }}>v{report.header.versionNumber}  /  {report.mode}</Text></View>
        <View style={styles.coverBody}>
          <Text style={styles.coverTitle}>{clean(report.header.businessName)}</Text>
          <View style={styles.coverMeta}><Text style={styles.pill}>{clean(report.header.location)}</Text><Text style={styles.pill}>{clean(report.header.primaryService)}</Text></View>
        </View>
        <View style={styles.coverDecision}><Text style={styles.coverLabel}>The decision</Text><Text style={styles.coverDecisionText}>{clean(report.mode === "advisor" ? report.executiveDecision.decision_summary : report.clientSummary.headline)}</Text></View>
        {showBranding ? <View style={styles.agencyPanel}>{branding?.agencyLogoData ? <Image src={branding.agencyLogoData} style={styles.logo} /> : null}<View style={styles.agencyCopy}><Text style={styles.agencyName}>{clean(branding?.agencyName || "Agency report")}</Text>{branding?.clientName ? <Text style={styles.agencyClient}>Prepared for {clean(branding.clientName)}</Text> : null}</View></View> : null}
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <PageHeader report={report} label="Decision and market" />
        <Text style={styles.eyebrow}>Core problem</Text><Text style={styles.title}>{clean(report.clientSummary.coreProblem)}</Text>
        <View style={styles.darkCard}><Text style={styles.darkTitle}>Opportunity</Text><Text style={styles.darkBody}>{clean(report.clientSummary.opportunity)}</Text>{report.mode === "advisor" ? <Text style={styles.darkFoot}>{clean(report.executiveDecision.why_now)}</Text> : null}</View>
        <Text style={styles.eyebrow}>Competitive set</Text><Text style={styles.lead}>{clean(report.competitorAnalysis.comparisonSummary)}</Text>
        <View style={styles.grid3}>{report.competitorAnalysis.competitors.map((competitor) => <View key={competitor.websiteUrl} style={styles.third}><View style={styles.card}><Text style={styles.cardKicker}>Best rank #{competitor.bestPosition}</Text><Text style={styles.cardTitle}>{clean(competitor.businessName)}</Text><Text style={styles.body}>{competitor.queryAppearanceCount} tracked query appearances</Text><Bullets items={competitor.strengths} /></View></View>)}</View>
        {report.competitorAnalysis.limitations.map((item) => <Text key={item} style={styles.limitation}>Scope: {clean(item)}</Text>)}
        <PdfFooter note={branding?.footerNote} />
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <PageHeader report={report} label="Priority actions" />
        <Text style={styles.eyebrow}>Implementation sequence</Text><Text style={styles.title}>Three moves, in the right order.</Text>
        {report.actions.map((action) => <View key={action.actionId} style={styles.action} wrap={false}><View style={styles.actionRow}><Text style={styles.actionNumber}>0{action.sequence}</Text><View style={styles.actionCopy}><Text style={styles.actionTitle}>{clean(action.clientFacingExplanation)}</Text><Text style={styles.actionMeta}>{action.effort} effort  |  Review {clean(action.reviewDate)}</Text><Text style={styles.body}>{clean(action.whyNow)}</Text>{"implementationSteps" in action ? <><Text style={[styles.cardKicker, { marginTop: 8 }]}>Implementation</Text><Bullets items={action.implementationSteps.map((step) => `${step.title}: ${step.instruction}`)} /><Text style={[styles.cardKicker, { marginTop: 8 }]}>Definition of done</Text><Bullets items={action.definitionOfDone} /></> : action.requiredClientAssets.length ? <><Text style={[styles.cardKicker, { marginTop: 8 }]}>Client inputs</Text><Bullets items={action.requiredClientAssets} /></> : null}</View></View></View>)}
        <PdfFooter note={branding?.footerNote} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageHeader report={report} label="90-day roadmap" />
        <Text style={styles.eyebrow}>Delivery sequence</Text><Text style={styles.title}>30 / 60 / 90</Text>
        <Text style={styles.lead}>Complete each phase's exit criteria before treating the next phase as fully active.</Text>
        <View style={styles.grid3}>{report.roadmap.map((phase) => <View key={phase.period} style={styles.third}><View style={styles.card}><Text style={styles.cardKicker}>{clean(phase.label)}</Text><Text style={styles.cardTitle}>{clean(phase.objective)}</Text><Bullets items={phase.exitCriteria} /></View></View>)}</View>
        <PdfFooter note={branding?.footerNote} />
      </Page>

      {report.mode === "advisor" ? <Page size="A4" style={styles.page} wrap><PageHeader report={report} label="Advisor diagnostics" /><Text style={styles.eyebrow}>Eight-layer assessment</Text><Text style={styles.title}>The full diagnostic view.</Text><View style={styles.layerGrid}>{report.layers.map((layer, index) => <View key={layer.layer_key} style={styles.layer}><View style={styles.layerInner}><Text style={styles.cardKicker}>Layer {index + 1}</Text><Text style={styles.cardTitle}>{clean(layer.label)}</Text><Text style={styles.body}>{clean(layer.summary)}</Text><Text style={styles.status}>{clean(layer.status)}</Text></View></View>)}</View><View style={styles.section}><Text style={styles.sectionTitle}>Findings and rule trace</Text>{report.findings.map((finding) => <View key={finding.finding_id} style={styles.finding} wrap={false}><Text style={styles.actionTitle}>{clean(finding.statement)}</Text><Text style={styles.findingMeta}>{finding.classification}  |  {finding.severity}  |  {finding.confidence}  |  {clean(finding.rule_id)}  |  {clean(finding.rule_version)}</Text></View>)}</View><PdfFooter note={branding?.footerNote} /></Page> : null}

      <Page size="A4" style={styles.page} wrap>
        <PageHeader report={report} label="Limits and next review" />
        <Text style={styles.eyebrow}>Report boundaries</Text><Text style={styles.title}>What this conclusion does - and does not - cover.</Text>
        {report.limitations.length ? report.limitations.map((item) => <Text key={`${item.category}-${item.description}`} style={styles.limitation}>{clean(item.severity.toUpperCase())} / {clean(item.category)}: {clean(item.description)}</Text>) : <Text style={styles.lead}>No material report-wide limitations were recorded.</Text>}
        {report.mode === "advisor" ? <View style={styles.section}><Text style={styles.sectionTitle}>Data coverage</Text>{report.dataCoverage.sources.map((source) => <View key={source.source_type} style={styles.finding}><Text style={styles.actionTitle}>{source.source_type.toUpperCase()}  /  {clean(source.health_status)}  /  {clean(source.identity_match_status)}</Text><Text style={styles.body}>{clean(source.coverage_summary)}</Text></View>)}</View> : <View style={styles.darkCard}><Text style={styles.darkTitle}>Next review</Text><Text style={styles.darkBody}>{clean(report.clientSummary.nextReviewDate)}</Text><Text style={styles.darkFoot}>Revisit the plan after the first implementation cycle and its exit criteria are complete.</Text></View>}
        <PdfFooter note={branding?.footerNote} />
      </Page>
    </Document>
  );
}
