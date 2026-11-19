// @vitest-environment jsdom
import React from "react";
import {cleanup, render, screen, within} from "@testing-library/react";
import {renderToBuffer} from "@react-pdf/renderer";
import {afterEach, expect, it} from "vitest";
import {CapabilityReportDocument} from "@/components/report/CapabilityReportDocument";
import {CapabilitySharedReport} from "@/components/report/CapabilitySharedReport";
import {CapabilityReportPDFDocument} from "@/components/report/pdf/CapabilityReportPDFDocument";
import candidate from "./fixtures/candidates/v20.json";
import identity from "./fixtures/identity-v2/v20.json";
import {buildApprovedCapabilityDelivery} from "./delivery";
import {projectCapabilityReport} from "./projection";
import {initialCapabilityRevision} from "./revision";
import {validateCapabilityReport} from "./validate";

const INTERNAL = /\/payload\/|snapshot_id|technical|evidenceIds|action_example_policy_v1|v22_|rank_source| · en · mobile|36\.\d+,-119\./;

function fixture() {
  const parsed = validateCapabilityReport(candidate);
  if (!parsed.ok) throw new Error("Invalid exported v20 candidate fixture");
  const {report} = parsed;
  const content = initialCapabilityRevision(report);
  content.status = "approved";
  const delivery = buildApprovedCapabilityDelivery(report, {
    id: "00000000-0000-4000-8000-000000009998",
    report_id: report.id,
    user_id: report.input_manifest.user_id,
    case_id: report.input_manifest.case_id,
    revision: 1,
    status: "approved",
    approved_at: report.generated_at,
    content,
  });
  return {report, delivery, content};
}

function pdfText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const value = node as {type?: string; value?: string; children?: unknown[]};
  return value.type === "TEXT_INSTANCE" ? value.value ?? "" : value.children?.map(pdfText).join("\n") ?? "";
}

afterEach(cleanup);

it("validates both v20 compatibility exports and rejects invented or stale structured advice", () => {
  expect(identity).toEqual(candidate);
  const {report} = fixture();
  for (const changed of ["example", "where", "evidence", "v19"]) {
    const bad = structuredClone(report);
    const item = bad.action_advice!.find(row => row.example)!;
    if (changed === "example") item.example!.text += " Guaranteed results.";
    if (changed === "where") item.where = "https://example.test/elsewhere";
    if (changed === "evidence") item.evidence_ids[0] = "unbound-evidence";
    if (changed === "v19") bad.input_manifest.ruleset_version = "v22_capability_public_v19";
    expect(validateCapabilityReport(bad).ok).toBe(false);
  }
});

it("renders the same clean action structure on customer web and sharing with advisor rejection details isolated", () => {
  const {report, delivery} = fixture();
  for (const shared of [false, true]) {
    render(shared ? <CapabilitySharedReport delivery={delivery} token="local-test"/>
      : <CapabilityReportDocument document={projectCapabilityReport(report, undefined, true)}/>);
    const advice = screen.getAllByRole("region", {name: "Structured recommendation"});
    expect(advice).toHaveLength(report.actions.length);
    const example = advice.find(row => row.textContent?.includes("Example copy"))!;
    for (const label of ["Problem", "Evidence", "Why it matters", "How to fix it", "Where to make the change",
      "Example copy", "Priority / effort", "Confidence", "How to verify"]) {
      expect(within(example).getByText(label)).toBeTruthy();
    }
    expect(example.textContent).not.toMatch(INTERNAL);
    expect(screen.queryByText("This action does not have an approved example format.")).toBeNull();
    cleanup();
  }
  expect(JSON.stringify(delivery.document.actions.map(action=>action.advice))).not.toMatch(INTERNAL);
  render(<CapabilityReportDocument document={projectCapabilityReport(report)} technicalDetails/>);
  expect(screen.getByText("This action does not have an approved example format.")).toBeTruthy();
});

it("uses the shared clean advice in the PDF and hides an example after edits", async () => {
  const {report, delivery, content} = fixture();
  let output = "";
  const pdf = await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}), {
    onRender: (data: unknown) => {output = pdfText((data as {_INTERNAL__LAYOUT__DATA_: unknown})._INTERNAL__LAYOUT__DATA_);},
  }));
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  const example = report.action_advice!.find(item => item.example)!;
  expect(output).toContain(example.example!.text);
  expect(output).toContain("Where to make the change");
  expect(output).not.toContain("Advice evidence and validation");
  expect(output).not.toContain("action_example_policy_v1");
  content.actions.find(action => action.id === example.action_id)!.title = "Advisor-edited title";
  const updated = projectCapabilityReport(report, content, true);
  expect(updated.actions.find(action => action.id === example.action_id)?.advice?.example).toBeUndefined();
});

it("renders a verbatim same-site reference and omits its technical locator", async () => {
  const {report, delivery} = fixture();
  const action = delivery.document.actions.find(item => item.advice?.example)!;
  const quote = "We provide plumbing repair in Fresno.";
  const url = "https://allstarplumbingfresno.com/about";
  // Exercise the text and source display without inventing evidence in the frozen fixtures.
  action.advice = {...action.advice!, example: undefined, reference: {text: quote, url}};
  for (const shared of [false, true]) {
    render(shared ? <CapabilitySharedReport delivery={delivery} token="local-test"/>
      : <CapabilityReportDocument document={delivery.document}/>);
    expect(screen.getByText(quote)).toBeTruthy();
    expect(screen.getByRole("link", {name: url}).getAttribute("href")).toBe(url);
    expect(screen.queryByText("Advice evidence and validation")).toBeNull();
    cleanup();
  }
  let output = "";
  await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}), {
    onRender: (data: unknown) => {output = pdfText((data as {_INTERNAL__LAYOUT__DATA_: unknown})._INTERNAL__LAYOUT__DATA_);},
  }));
  expect(output).toContain(quote);
  expect(output).toContain(url);
  expect(output).not.toContain("/payload/");
  expect(report.input_manifest.ruleset_version).toBe("v22_capability_public_v20");
});
