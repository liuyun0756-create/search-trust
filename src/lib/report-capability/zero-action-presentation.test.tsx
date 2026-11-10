// @vitest-environment jsdom
import { readFileSync, writeFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CapabilityReportDocument } from "@/components/report/CapabilityReportDocument";
import { readerLimits, readerLimitDetails } from "./reader-copy";
import { readerFinding } from "./reader-copy";
import { projectCapabilityReport } from "./projection";
import { validateCapabilityReport } from "./validate";
import type { CapabilityReport } from "./generated/types";

const domainLines = [
  "Domain coverage for 'Plumbing Services Fresno' (maps) remains unverified: the sample does not establish absence.",
  "Domain coverage for 'Plumbing Services near me' (organic) remains unverified: the sample does not establish absence.",
];
const comparisonLines = [
  "The full competitor-position comparison for 'Plumbing Services Fresno' (maps) could not be completed.",
  "The full competitor-position comparison for 'best Plumbing Services Fresno' (organic) could not be completed.",
];
const grouped = [
  "Domain coverage remains unverified for these saved samples:\n" + domainLines.join("\n"),
  "Full competitor-position comparisons remain incomplete for these saved samples:\n" + comparisonLines.join("\n"),
];
afterEach(cleanup);
function fixtureDocument() {
  const report = JSON.parse(readFileSync(`${process.cwd()}/src/lib/report-capability/fixtures/generated/service-first.json`, "utf8")) as CapabilityReport;
  return projectCapabilityReport(report, undefined, true);
}

describe("grouped report limits", () => {
  it("removes rank-source bookkeeping from confirmed client facts without mutating technical copy", () => {
    const fact = {kind:"fact" as const,status:"confirmed" as const,
      observed_fact:"Observed at position 2 (rank_source=provider_position), and 3 (rank_source=response_order).",
      judgment:"Saved observation only.",impact_path:"No effect established."};
    const before = JSON.stringify(fact);
    expect(readerFinding(fact).observed_fact).toBe("Observed at position 2, and 3.");
    expect(JSON.stringify(fact)).toBe(before);
  });
  it("deduplicates compact reading while retaining full text for other consumers", () => {
    expect(readerLimits([...grouped, grouped[0]])).toEqual(grouped);
    expect(readerLimitDetails([...grouped, grouped[1]])).toEqual(grouped);
    const compact = readerLimits([...grouped, grouped[0], "Another check remains unverified."], true);
    expect(compact).toHaveLength(3);
    expect(compact.join(" ")).not.toContain("Plumbing Services Fresno");
    expect(compact.join(" ")).toContain("does not establish absence");
    for (const line of [...domainLines, ...comparisonLines]) expect(readerLimits(grouped).join("\n")).toContain(line);
  });

  it("puts every query/type in a closed Technical details disclosure", () => {
    const document = fixtureDocument();
    document.limitations = [...grouped, "Another check remains unverified."];
    const before = JSON.stringify(document);
    render(<CapabilityReportDocument document={document} />);
    const disclosure = screen.getByText("Technical details").closest("details")!;
    expect(disclosure.hasAttribute("open")).toBe(false);
    const details = within(disclosure).getByRole("list", { name: "Detailed review limits", hidden: true });
    for (const line of [...domainLines, ...comparisonLines]) expect(details.textContent).toContain(line);
    expect(screen.getByText("Another check remains unverified.")).toBeTruthy();
    expect(JSON.stringify(document)).toBe(before);
  });

  it("does not add a disclosure or change historical ungrouped limits", () => {
    const document = fixtureDocument();
    document.limitations = ["A sampled difference does not establish a ranking cause."];
    render(<CapabilityReportDocument document={document} />);
    expect(screen.queryByText("Technical details")).toBeNull();
    expect(screen.getByText(document.limitations[0])).toBeTruthy();
  });
});

const replayFile = process.env.ZERO_ACTION_REPLAY_REPORT;
it.skipIf(!replayFile)("renders the same local-Supabase 67cb replay (requires ZERO_ACTION_REPLAY_REPORT; no collection)", () => {
  const report = JSON.parse(readFileSync(replayFile!, "utf8")) as CapabilityReport;
  expect(validateCapabilityReport(report).ok).toBe(true);
  expect(report.id).toBe("67cb1b78-ccb2-4fe0-80dc-c982697c10bd");
  expect(report.actions).toEqual([]);
  expect(report.action_state).toBe("insufficient_basis");
  const before = JSON.stringify(report);
  const doc = projectCapabilityReport(report, undefined, true);
  const html = renderToStaticMarkup(<CapabilityReportDocument document={doc} />);
  expect(html).toContain("This sample did not identify a supported change to propose.");
  expect(html).toContain("position 2");
  expect(html).toContain("position 1");
  expect(html).not.toContain("rank_source");
  expect(report.summary).toBe("This sample did not identify a supported change to propose. Observed Maps positions: Plumbing Services Fresno: 2; Plumbing Services near me: 2; best Plumbing Services Fresno: 1. Unverified checks and sample limits are listed below.");
  expect(renderToStaticMarkup(<CapabilityReportDocument document={doc} technicalDetails />)).toContain("rank_source=provider_position");
  expect(html).not.toMatch(/v22_public\.|v22_capability_|\/payload\/|36\.8353312|-119\.8930904|· en · mobile/);
  expect(html).not.toContain("<details open");
  const disclosure = html.slice(html.indexOf("Technical details"));
  for (const limit of report.limitations.filter(v => v.includes("these saved samples:\n"))) {
    for (const line of limit.split("\n").slice(1)) {
      // Static HTML escapes quotation marks; DOM checks below compare exact text.
      expect(disclosure).toContain(line.replaceAll("'", "&#x27;"));
    }
  }
  render(<CapabilityReportDocument document={doc} />);
  const details = screen.getByText("Technical details").closest("details")!;
  expect(details.hasAttribute("open")).toBe(false);
  expect(within(details).getByRole("list", { name: "Detailed review limits", hidden: true }).textContent).toContain("Plumbing Services near me");
  expect(JSON.stringify(report)).toBe(before);
  if (process.env.ZERO_ACTION_CLIENT_HTML) writeFileSync(process.env.ZERO_ACTION_CLIENT_HTML,
    '<!doctype html><html lang="en"><meta charset="utf-8"><title>Offline All Star report preview</title><body>' + html + "</body></html>");
});

const oldFile = process.env.ZERO_ACTION_OLD_REPORTS;
describe.skipIf(!oldFile)("stored v12 compatibility (requires read-only ZERO_ACTION_OLD_REPORTS export)", () => {
  for (const id of ["912ddcd2-7135-439a-afa4-de6fcf1e9079", "67cb1b78-ccb2-4fe0-80dc-c982697c10bd"]) {
    it(`validates and renders immutable stored report ${id}`, () => {
      const rows = JSON.parse(readFileSync(oldFile!, "utf8")) as {id:string;payload:CapabilityReport;payload_checksum:string}[];
      const row = rows.find(r => r.id === id)!;
      const before = JSON.stringify(row);
      expect(validateCapabilityReport(row.payload).ok).toBe(true);
      expect(row.payload.findings).toHaveLength(2);
      const html = renderToStaticMarkup(<CapabilityReportDocument document={projectCapabilityReport(row.payload, undefined, true)} />);
      expect(html).toContain("Plumbing Services");
      expect(html).not.toContain("rank_source");
      expect(html).not.toMatch(/v22_public\.|\/payload\/|· en · mobile/);
      expect(JSON.stringify(row)).toBe(before);
    });
  }
});
