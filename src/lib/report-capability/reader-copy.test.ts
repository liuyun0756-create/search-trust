import { describe, expect, it } from "vitest";
import { readerLimit, readerLimits, evidenceFieldLabel, evidenceValue, observationWarnings } from "./reader-copy";
import { generatedDelivery } from "./fixtures/generated-delivery";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { CapabilityReportDocument } from "@/components/report/CapabilityReportDocument";

describe("client-facing report copy", () => {
  it("keeps raw paths available to the SEO while client reading uses labels", () => {
    const { delivery } = generatedDelivery("service-first.json");
    delivery.document.findings[0].limitations.push("candidate_exhausted", "SERP_LOCAL_PACK_SECTION_INVALID");
    const client = renderToStaticMarkup(createElement(CapabilityReportDocument, { document: delivery.document }));
    expect(client).not.toContain("/payload/");
    expect(client).not.toContain("candidate_exhausted");
    expect(client).not.toContain("SERP_LOCAL_PACK_SECTION_INVALID");
    expect(client).toContain("not evidence that the business is absent");
    const owner = renderToStaticMarkup(createElement(CapabilityReportDocument, { document: delivery.document, technicalDetails: true }));
    expect(owner).toContain("Inspect source references");
    expect(owner).toContain("/payload/");
    expect(owner).not.toContain("<details open");
  });
  it("warns on historical missing-field findings without rewriting saved facts", () => {
    const { report } = generatedDelivery("service-first.json");
    report.evidence[0].value = "site_missing";
    report.findings[0].rule_id = "v22_public.gbp_phone_alignment";
    report.findings[0].evidence_ids = [report.evidence[0].id];
    const before = JSON.stringify(report);
    expect(observationWarnings(report)[0]).toContain("do not establish a website/profile mismatch");
    expect(JSON.stringify(report)).toBe(before);
    report.evidence[0].value = "Observed business detail";
    expect(observationWarnings(report)).toEqual([]);
  });
  it("explains missing values without presenting them as a mismatch", () => {
    expect(evidenceValue("site_missing")).toBe("Not observed in the checked website sample");
    expect(evidenceValue("gbp_missing")).toContain("Not observed");
    expect(evidenceValue(5)).toBe("5");
  });
  it("explains collection errors and internal bookkeeping without dropping the limit", () => {
    expect(readerLimit("SERP_LOCAL_PACK_SECTION_INVALID")).toContain("not evidence that the business is absent");
    expect(readerLimit("v22_public.market_site_domain_unobserved: identity_unresolved")).toContain("remain unverified");
    expect(readerLimit("candidate_exhausted")).toContain("Confirm it directly");
    expect(readerLimit("V22.CROSS_SOURCE.GSC_GA4.PAGE_DIRECTION_CONFLICT: page_identity_ambiguous")).toBe("The search console analytics page direction conflict check remains unverified: page identity ambiguous.");
    expect(readerLimit("Confirmed-identity site/GBP alignment evidence was added for this offline evaluation.")).not.toContain("offline");
  });
  it("retains substantive limits and deduplicates equivalent explanations", () => {
    const statement = "A sampled difference does not establish a ranking cause.";
    expect(readerLimit(statement)).toBe(statement);
    expect(readerLimits([statement, statement])).toEqual([statement]);
  });
  it("uses a readable field label while retaining source values", () => {
    expect(evidenceFieldLabel("/payload/query_runs/1/results/7/position")).toBe("Observed search position");
    expect(evidenceFieldLabel("/payload/record/fields/service_areas/state")).toBe("Observation status");
    expect(evidenceValue("https://example.com/service")).toBe("https://example.com/service");
  });
});
