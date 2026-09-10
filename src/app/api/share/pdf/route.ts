import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { ReportV22PDFDocument } from "@/components/report/pdf/ReportV22PDFDocument";
import { readShareToken } from "@/lib/report-shares/public-request";
import { ReportShareNotFoundError } from "@/lib/report-shares/service";
import { createServerReportShareService } from "@/lib/report-shares/server";

export const runtime = "nodejs";

const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function POST(request: Request) {
  const token = await readShareToken(request);
  if (!token) return NextResponse.json({ error: "Report share not found" }, { status: 404, headers: HEADERS });

  try {
    const resolved = await createServerReportShareService().resolve(token);
    const document = React.createElement(ReportV22PDFDocument, { report: resolved.report }) as React.ReactElement<any>;
    const buffer = await renderToBuffer(document);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        ...HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="SearchTrust-Client-Report.pdf"',
      },
    });
  } catch (error) {
    if (error instanceof ReportShareNotFoundError) {
      return NextResponse.json({ error: "Report share not found" }, { status: 404, headers: HEADERS });
    }
    console.error("Shared report PDF failed", {
      error_type: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: "Unable to generate PDF" }, { status: 500, headers: HEADERS });
  }
}
