import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { ReportPDFDocument } from "@/components/report/pdf/ReportPDFDocument";
import { getReportPdfExportabilitySignals, isReportPdfExportable } from "@/lib/report-v21";
import type { Report } from "@/types/database";

export const runtime = "nodejs";

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-");
}

function safeKeys(value: unknown): string[] {
  if (!value) return [];

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.keys(parsed).slice(0, 20);
      }
    } catch {
      return [];
    }

    return [];
  }

  if (typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).slice(0, 20);
}

function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const debug = request.nextUrl.searchParams.get("debug") === "1";
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
    const reportRecord = report as unknown as Record<string, unknown>;
    const exportable = isReportPdfExportable(report);
    const exportabilitySignals = getReportPdfExportabilitySignals(report);

    console.info("[PDF route exportability]", {
      id,
      reportId: report.report_id,
      status: report.status,
      hasReportV21: exportabilitySignals.hasReportV21,
      hasScore: exportabilitySignals.hasScore,
      hasLegacyModules: exportabilitySignals.hasLegacyModules,
      hasStatusCards: exportabilitySignals.hasStatusCards,
      hasIdentity: exportabilitySignals.hasIdentity,
      exportable,
    });

    if (debug) {
      return NextResponse.json({
        id,
        reportId: report.report_id ?? null,
        status: report.status ?? null,
        hasReportV21: Boolean(reportRecord.report_v2_1),
        reportV21Type: valueType(reportRecord.report_v2_1),
        reportV21Keys: safeKeys(reportRecord.report_v2_1),
        hasScore: Boolean(reportRecord.score),
        scoreType: valueType(reportRecord.score),
        hasLegacyModules: Boolean(
          reportRecord.module_1_overview ||
          reportRecord.module_2_page_level ||
          reportRecord.module_3_key_problems ||
          reportRecord.module_4_eight_layers ||
          reportRecord.module_5_optimization
        ),
        legacyModuleKeys: {
          module_1_overview: safeKeys(reportRecord.module_1_overview),
          module_2_page_level: safeKeys(reportRecord.module_2_page_level),
          module_3_key_problems: safeKeys(reportRecord.module_3_key_problems),
          module_4_eight_layers: safeKeys(reportRecord.module_4_eight_layers),
          module_5_optimization: safeKeys(reportRecord.module_5_optimization),
        },
        hasStatusCards: Boolean(
          reportRecord.trust_status ||
          reportRecord.ranking_potential ||
          reportRecord.risk_level
        ),
        hasIdentity: Boolean(
          reportRecord.id ||
          reportRecord.report_id ||
          reportRecord.page_url ||
          reportRecord.analyzed_url
        ),
        exportable,
      });
    }

    if ((report.status === "pending" || report.status === "failed") && !exportable) {
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
