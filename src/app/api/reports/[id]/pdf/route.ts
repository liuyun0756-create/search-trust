import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { ReportPDFDocument } from "@/components/report/pdf/ReportPDFDocument";
import { ReportV22PDFDocument } from "@/components/report/pdf/ReportV22PDFDocument";
import { SAMPLE_REPORT_V21 } from "@/components/report/sampleReportV21";
import { getReportPdfExportabilitySignals, isReportPdfExportable } from "@/lib/report-v21";
import { findUserReportByIdentifier } from "@/lib/server/reportLookup";
import type { EffectiveBranding, PdfVariant } from "@/lib/report-v21";
import { parsePdfBranding } from "@/lib/report-pdf/branding";
import { buildReportV22ViewModel, validateReportV22 } from "@/lib/report-v22";
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

async function renderReportPdf(report: Report, branding: EffectiveBranding | undefined, variant: PdfVariant) {
  const validation = report.report_v2_2 ? validateReportV22(report.report_v2_2) : null;
  if (validation && !validation.ok) throw new Error("Stored v2.2 report is invalid.");
  const document = validation?.ok
    ? React.createElement(ReportV22PDFDocument, {
        report: variant === "client"
          ? buildReportV22ViewModel(validation.report, "client")
          : buildReportV22ViewModel(validation.report, "advisor"),
        branding,
      }) as React.ReactElement<any>
    : React.createElement(ReportPDFDocument, { report, branding, variant }) as React.ReactElement<any>;
  const buffer = await renderToBuffer(document);
  const reportId = report.external_report_id || report.report_id;
  const suffix = variant === "client" ? "Client" : "Full-Audit";
  const fileName = `SearchTrust-${sanitizeFileName(reportId)}-${suffix}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function parseVariant(value: unknown, defaultValue: PdfVariant = "full"): PdfVariant {
  if (value == null || value === "") return defaultValue;
  if (value === "client" || value === "full") return value;
  throw new Error('pdf_variant must be "client" or "full".');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const debug = request.nextUrl.searchParams.get("debug") === "1";
    const variant = parseVariant(request.nextUrl.searchParams.get("variant"));
    const { id } = await params;

    if (id === SAMPLE_REPORT_V21.id || id === SAMPLE_REPORT_V21.report_id) {
      if (debug) {
        return NextResponse.json({
          id,
          reportId: SAMPLE_REPORT_V21.report_id,
          status: SAMPLE_REPORT_V21.status,
          sample: true,
          hasReportV21: Boolean(SAMPLE_REPORT_V21.report_v2_1),
          reportV21Type: valueType(SAMPLE_REPORT_V21.report_v2_1),
          reportV21Keys: safeKeys(SAMPLE_REPORT_V21.report_v2_1),
          exportable: true,
        });
      }
      return renderReportPdf(SAMPLE_REPORT_V21, undefined, variant);
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data, error } = await findUserReportByIdentifier(supabase, user.userId, id);

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

    if ((report.status === "pending" || report.status === "failed") && !exportable && !report.report_v2_2) {
      return NextResponse.json({ error: "Report is still generating" }, { status: 409 });
    }

    return renderReportPdf(report, undefined, variant);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("pdf_variant")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Generate report PDF error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const branding = parsePdfBranding(body?.branding);
    const variant = parseVariant(body?.pdf_variant);

    if (id === SAMPLE_REPORT_V21.id || id === SAMPLE_REPORT_V21.report_id) {
      return renderReportPdf(SAMPLE_REPORT_V21, branding, variant);
    }

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createServerClient();
    const { data, error } = await findUserReportByIdentifier(supabase, user.userId, id);
    if (error || !data) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const report = data as Report;
    if ((report.status === "pending" || report.status === "failed") && !isReportPdfExportable(report) && !report.report_v2_2) {
      return NextResponse.json({ error: "Report is still generating" }, { status: 409 });
    }
    return renderReportPdf(report, branding, variant);
  } catch (error) {
    const message = error instanceof Error && (error.message.startsWith("Logo must") || error.message.startsWith("pdf_variant")) ? error.message : "Internal server error";
    if (message !== "Internal server error") return NextResponse.json({ error: message }, { status: 400 });
    console.error("Generate branded report PDF error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
