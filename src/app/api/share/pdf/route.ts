import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { ReportV22PDFDocument } from "@/components/report/pdf/ReportV22PDFDocument";
import { readShareToken } from "@/lib/report-shares/public-request";
import { ReportShareNotFoundError } from "@/lib/report-shares/service";
import { resolveVersionedShare } from "@/lib/report-shares/versioned";
import { capabilityPdfResponse } from "@/lib/report-capability/pdf";
import {reviewPdfResponse} from "@/lib/review-reports/pdf";

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
    const selected = await resolveVersionedShare(token);
    if(selected.kind === "review")return await reviewPdfResponse(selected.value.delivery);
    if(selected.kind === "capability")return await capabilityPdfResponse(selected.value.delivery);
    const resolved = selected.value;
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
    if(error instanceof Error && error.message === "CAPABILITY_PDF_UNSUPPORTED_TEXT") return NextResponse.json({error:"This report contains characters not supported by the PDF font. The online report remains available."},{status:422,headers:HEADERS});
    if (error instanceof ReportShareNotFoundError) {
      return NextResponse.json({ error: "Report share not found" }, { status: 404, headers: HEADERS });
    }
    console.error("Shared report PDF failed", {
      error_type: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: "Unable to generate PDF" }, { status: 500, headers: HEADERS });
  }
}
