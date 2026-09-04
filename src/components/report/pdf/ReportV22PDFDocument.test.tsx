import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import prospectFixture from "../../../lib/report-v22/contracts/fixtures/prospect.json";
import type { SearchTrustReportV2_2 } from "../../../lib/report-v22/generated/types";
import { buildReportV22ViewModel } from "../../../lib/report-v22/view-model";
import { ReportV22PDFDocument } from "./ReportV22PDFDocument";

const fixture = prospectFixture as unknown as SearchTrustReportV2_2;

describe("ReportV22PDFDocument", () => {
  it("renders both shared view-model projections as real PDF files", async () => {
    const client = await renderToBuffer(<ReportV22PDFDocument report={buildReportV22ViewModel(fixture, "client")} />);
    const advisor = await renderToBuffer(<ReportV22PDFDocument report={buildReportV22ViewModel(fixture, "advisor")} />);

    expect(client.subarray(0, 4).toString()).toBe("%PDF");
    expect(advisor.subarray(0, 4).toString()).toBe("%PDF");
    expect(client.length).toBeGreaterThan(5_000);
    expect(advisor.length).toBeGreaterThan(client.length);
    if (process.env.V22_PDF_OUTPUT_DIR) {
      const outputDirectory = path.resolve(process.env.V22_PDF_OUTPUT_DIR);
      await mkdir(outputDirectory, { recursive: true });
      await Promise.all([
        writeFile(path.join(outputDirectory, "searchtrust-v22-client.pdf"), client),
        writeFile(path.join(outputDirectory, "searchtrust-v22-advisor.pdf"), advisor),
      ]);
    }
  });

  it("accepts the existing ephemeral Agency Branding shape", async () => {
    const pdf = await renderToBuffer(<ReportV22PDFDocument
      report={buildReportV22ViewModel(fixture, "client")}
      branding={{ enabled: true, agencyName: "Northstar SEO", agencyLogoData: null, clientName: "Example Plumbing", footerNote: "Confidential" }}
    />);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
