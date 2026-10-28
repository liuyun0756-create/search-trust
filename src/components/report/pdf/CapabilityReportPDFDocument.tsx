import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ApprovedCapabilityDelivery } from "@/lib/report-capability/delivery";
import type { EffectiveBranding } from "@/lib/report-pdf/branding";
import { assertCapabilityPdfText } from "@/lib/report-pdf/capability-fonts";

const styles = StyleSheet.create({
  page: { padding: 38, paddingBottom: 72, fontFamily: "CapabilitySans", fontSize: 9, color: "#213D32", lineHeight: 1.5 },
  heading: { fontFamily: "CapabilitySansBold", fontSize: 24, lineHeight: 1.2, marginBottom: 16 },
  section: { fontFamily: "CapabilitySansBold", fontSize: 15, lineHeight: 1.25, marginTop: 18, marginBottom: 10 },
  kicker: { fontFamily: "CapabilitySansBold", color: "#5C805E", fontSize: 7, letterSpacing: 1.2, marginBottom: 9 },
  body: { marginBottom: 8 },
  meta: { color: "#66796D", fontSize: 7.5, marginBottom: 6 },
  card: { padding: 14, backgroundColor: "#F1F6EF", borderRadius: 8, marginBottom: 14 },
  evidenceCard: { paddingHorizontal: 14, paddingTop: 14, backgroundColor: "#F1F6EF", borderRadius: 8, marginBottom: 14 },
  title: { fontFamily: "CapabilitySansBold", fontSize: 11, lineHeight: 1.35, marginBottom: 8 },
  row: { paddingTop: 8, marginTop: 8 },
  note: { borderLeftWidth: 2, borderLeftColor: "#82A96D", paddingLeft: 10, marginTop: 8, marginBottom: 10 },
  brand: { marginBottom: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { width: 85, height: 34, objectFit: "contain" },
  footer: { position: "absolute", top: 790, left: 38, right: 38, borderTopWidth: 0.5, borderTopColor: "#DDE6DB", paddingTop: 7, fontSize: 7, color: "#66796D", flexDirection: "row", justifyContent: "space-between" },
});

// Keep typography substitutions separate from evidence/projection content.
function clean(value: string) {
  const text = value.replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, "...").replace(/\u2192/g, "->");
  assertCapabilityPdfText(text);
  return text;
}
function checkText(value: unknown): void {
  if (typeof value === "string") { clean(value); return; }
  if (Array.isArray(value)) { value.forEach(checkText); return; }
  if (value && typeof value === "object") Object.values(value).forEach(checkText);
}
function Copy({ children, style = styles.body }: { children: string; style?: (typeof styles)[keyof typeof styles] }) {
  return <Text style={style} minPresenceAhead={style === styles.title || style === styles.section ? 48 : 0}>{clean(children)}</Text>;
}
function Footer({ delivery, note }: { delivery: ApprovedCapabilityDelivery; note?: string | null }) {
  return <View fixed style={styles.footer}><Text style={{ width: 450 }}>{clean(note || `SearchTrust | Approved revision ${delivery.revision}`)}</Text><Text style={{ width: 45, textAlign: "right" }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>;
}

/** Pure renderer of one approved projection. No report rewording or fetching. */
export function CapabilityReportPDFDocument({ delivery, branding }: { delivery: ApprovedCapabilityDelivery; branding?: EffectiveBranding }) {
  const d = delivery.document;
  const brand = branding?.enabled ? branding : undefined;
  if (brand?.agencyLogoData && (brand.agencyLogoData.length > 1_500_000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(brand.agencyLogoData))) throw new Error("CAPABILITY_PDF_LOGO_INVALID");
  checkText(delivery);
  checkText([brand?.agencyName, brand?.clientName, brand?.footerNote]);
  const evidence = new Map(d.evidence.map((item) => [item.id, item]));
  const reportLabel = delivery.reportType === "prospect" ? "Prospect Evidence Report" : "Verified Action Plan";
  return <Document title={clean(d.title)} author={clean(brand?.agencyName || "SearchTrust")} subject={`${reportLabel} - approved revision ${delivery.revision}`}>
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.brand}><Copy style={styles.kicker}>SEARCHTRUST / CLIENT DELIVERY</Copy>{brand?.agencyLogoData ? <Image src={brand.agencyLogoData} style={styles.logo} /> : null}</View>
      <Copy style={styles.meta}>{`${reportLabel} | Report version ${delivery.reportVersion} | Approved revision ${delivery.revision}`}</Copy>
      <Copy style={styles.heading}>{d.title}</Copy>
      {brand?.agencyName ? <Copy style={styles.meta}>{`Prepared by ${brand.agencyName}`}</Copy> : null}
      {brand?.clientName ? <Copy style={styles.meta}>{`Prepared for ${brand.clientName}`}</Copy> : null}
      <Copy style={styles.meta}>{`${delivery.siteUrl} | ${delivery.market} | Evaluated ${delivery.evaluatedAt}`}</Copy>
      <View style={styles.card}><Copy style={styles.kicker}>THE DECISION</Copy><Copy>{d.summary}</Copy></View>
      <Copy style={styles.section}>{d.actions.length ? "Proposed work, in order" : "No action proposed"}</Copy>
      {d.actions.length ? d.actions.map((action) => <View key={action.id} style={styles.row} wrap={false}>
        <Copy style={styles.title}>{`${String(action.sequence).padStart(2, "0")} / ${action.title}`}</Copy>
        <Copy style={styles.meta}>{action.target}</Copy>
      </View>) : <Copy>The eligible evidence supports a diagnosis, not a proposed change. Review the recorded observations and unresolved checks before deciding what to investigate next.</Copy>}
      {d.clientNote ? <View style={styles.note}><Copy style={styles.title}>Note from your SEO</Copy><Copy>{d.clientNote}</Copy></View> : null}
      <Footer delivery={delivery} note={brand?.footerNote} />
    </Page>
    <Page size="A4" style={styles.page} wrap>
      <Copy style={styles.kicker}>CHECKED EVIDENCE</Copy><Copy style={styles.heading}>The basis for the decision</Copy>
      {d.findings.map((finding) => <View key={finding.id} style={styles.evidenceCard}>
        <View wrap={finding.target.length + finding.observed_fact.length > 600}>
          <Copy style={styles.title}>{finding.target}</Copy><Copy>{finding.observed_fact}</Copy>
        </View>
        <Copy>{finding.judgment}</Copy><Copy>{finding.impact_path}</Copy>
        <Copy style={styles.meta}>{`${finding.comparison_scope} | ${finding.observed_at}`}</Copy>
        {finding.evidence_ids.map((id) => { const item = evidence.get(id)!; return <View key={id} style={styles.row} wrap={item.object.length + item.field_path.length + String(item.value).length > 1000}>
          <Copy style={styles.meta}>{`${item.object} | ${item.field_path}`}</Copy>
          <Copy>{`${item.value === null ? "Not observed" : String(item.value)}${item.unit ? ` ${item.unit}` : ""}`}</Copy>
          <Copy style={styles.meta}>{`${item.comparison_scope} | ${item.observed_at}`}</Copy>
        </View>; })}
        {finding.limitations.map((limit, index) => <Copy key={index} style={styles.meta}>{`Limit: ${limit}`}</Copy>)}
      </View>)}
      <Footer delivery={delivery} note={brand?.footerNote} />
    </Page>
    {d.actions.map((action) => <Page key={action.id} size="A4" style={styles.page} wrap>
      <Copy style={styles.kicker}>{`ACTION ${String(action.sequence).padStart(2, "0")}`}</Copy>
      <Copy style={styles.heading}>{action.title}</Copy><Copy style={styles.meta}>{`Target: ${action.target}`}</Copy>
      {action.whyNow ? <View style={styles.card}>
        <Copy style={styles.title}>{action.whyNow.deliveryChanged ? `System recommendation - original position ${action.whyNow.systemPosition}` : "Why now"}</Copy>
        <Copy>{action.whyNow.explanation}</Copy>
        {action.whyNow.deliveryChanged ? <Copy>{`The delivery plan was edited. This rationale describes the original recommendation: ${action.whyNow.systemTitle} | ${action.whyNow.systemTarget}`}</Copy> : null}
        <Copy>{`Prerequisites: ${action.whyNow.prerequisites.join("; ") || "No explicit prerequisite action recorded."}`}</Copy>
        <Copy>{`Business relevance: ${action.whyNow.business}`}</Copy><Copy>{`Evidence: ${action.whyNow.evidence}`}</Copy>
        <Copy>{`Execution conditions: ${action.whyNow.execution}`}</Copy>
        {action.whyNow.impactPaths.map((path,i) => <Copy key={`impact-${i}`}>{`Potential impact path: ${path}`}</Copy>)}
        {action.whyNow.comparisonScopes.map((scope,i) => <Copy key={`scope-${i}`} style={styles.meta}>{`Checked scope: ${scope}`}</Copy>)}
        {action.whyNow.limits.map((limit,i) => <Copy key={`limit-${i}`} style={styles.meta}>{limit}</Copy>)}
        <Copy style={styles.meta}>{`Rule: ${action.whyNow.rulesVersion} | ${action.whyNow.reasonCodes.join(" | ")}`}</Copy>
      </View> : null}
      <Copy style={styles.section}>Execution steps</Copy>{action.steps.map((step, i) => <Copy key={i}>{`${i + 1}. ${step}`}</Copy>)}
      <Copy style={styles.section}>Completion checks</Copy>{action.completion.map((item, i) => <Copy key={i}>{`- ${item}`}</Copy>)}
      <Copy style={styles.section}>Review basis</Copy><Copy>{action.review}</Copy>
      {action.materials.map((material) => <View key={material.id} style={styles.card}>
        <Copy style={styles.title}>{material.title}</Copy>
        <Copy style={styles.kicker}>{material.readiness === "requires_confirmation" ? "CONFIRM BEFORE PUBLISHING" : material.readiness === "ready_to_use" ? "READY FOR YOUR REVIEW" : "EXECUTION INSTRUCTIONS"}</Copy>
        <Copy style={styles.meta}>{`Material target: ${material.target}`}</Copy><Copy>{material.body}</Copy>
        {material.confirmation_items.map((item, i) => <Copy key={i}>{`Confirm: ${item}`}</Copy>)}
      </View>)}
      <Footer delivery={delivery} note={brand?.footerNote} />
    </Page>)}
    <Page size="A4" style={styles.page} wrap><Copy style={styles.kicker}>SCOPE AND LIMITS</Copy><Copy style={styles.heading}>What this report does not establish</Copy>
      {d.limitations.map((limit, index) => <Copy key={index}>{`- ${limit}`}</Copy>)}
      <Copy style={styles.meta}>{`Source report ${delivery.reportId} | Approved revision ${delivery.revisionId} | ${delivery.contentChecksum}`}</Copy>
      <Footer delivery={delivery} note={brand?.footerNote} />
    </Page>
  </Document>;
}
