import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { ReportPDFDocument } from "@/components/report/pdf/ReportPDFDocument";
import type { Report } from "@/types/database";

export const runtime = "nodejs";

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServerClient();
    const query = supabase
      .from("reports")
      .select("*")
      .eq("user_id", user.userId);

    const isUUID = /^[0-9a-f]{8}-/.test(id);
    const { data, error } = await (isUUID
      ? query.eq("id", id).single()
      : query.eq("report_id", id).single());

    if (error || !data) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const report = data as Report;
    if (report.status === "pending") {
      return NextResponse.json({ error: "Report is still generating" }, { status: 409 });
    }

    const document = React.createElement(ReportPDFDocument, { report }) as React.ReactElement<any>;
    const buffer = await renderToBuffer(document);
    const reportId = report.external_report_id || report.report_id;
    const fileName = `SearchTrust-${sanitizeFileName(reportId)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Generate report PDF error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
