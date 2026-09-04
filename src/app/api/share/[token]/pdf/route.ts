import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { ReportV22PDFDocument } from "@/components/report/pdf/ReportV22PDFDocument";
import { ReportShareNotFoundError } from "@/lib/report-shares/service";
import { createServerReportShareService } from "@/lib/report-shares/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const resolved = await createServerReportShareService().resolve(token);
    const document = React.createElement(ReportV22PDFDocument, { report: resolved.report }) as React.ReactElement<any>;
    const buffer = await renderToBuffer(document);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="SearchTrust-Client-Report.pdf"',
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, noarchive",
      },
    });
  } catch (error) {
    if (error instanceof ReportShareNotFoundError) {
      return NextResponse.json({ error: "Report share not found" }, { status: 404 });
    }
    console.error("Shared report PDF failed", { error_type: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Unable to generate PDF" }, { status: 500 });
  }
}
