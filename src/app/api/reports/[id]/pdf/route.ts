import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { ReportV22PDFDocument } from "@/components/report/pdf/ReportV22PDFDocument";
import { getCurrentUser } from "@/lib/auth";
import { parsePdfBranding, type EffectiveBranding, type PdfVariant } from "@/lib/report-pdf/branding";
import { buildReportV22ViewModel, validateReportV22 } from "@/lib/report-v22";
import type { SearchTrustReportV2_2 } from "@/lib/report-v22/generated/types";
import { findUserReportByIdentifier } from "@/lib/server/reportLookup";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-");
}

function parseVariant(value: unknown, defaultValue: PdfVariant = "full"): PdfVariant {
  if (value == null || value === "") return defaultValue;
  if (value === "client" || value === "full") return value;
  throw new Error('pdf_variant must be "client" or "full".');
}

async function renderReportPdf(
  report: SearchTrustReportV2_2,
  branding: EffectiveBranding | undefined,
  variant: PdfVariant,
) {
  const viewModel = variant === "client"
    ? buildReportV22ViewModel(report, "client")
    : buildReportV22ViewModel(report, "advisor");
  const document = React.createElement(ReportV22PDFDocument, {
    report: viewModel,
    branding,
  }) as React.ReactElement<any>;
  const buffer = await renderToBuffer(document);
  const suffix = variant === "client" ? "Client" : "Full-Audit";
  const fileName = `SearchTrust-${sanitizeFileName(report.report_version.report_id)}-${suffix}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function loadReport(id: string) {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data, error } = await findUserReportByIdentifier(createServerClient(), user.userId, id);
  if (error || !data) return { response: NextResponse.json({ error: "Report not found" }, { status: 404 }) };
  if (!data.report_v2_2) {
    return { response: NextResponse.json({ error: "Report is still generating" }, { status: 409 }) };
  }

  const validation = validateReportV22(data.report_v2_2);
  if (!validation.ok) {
    console.error("Stored v2.2 report failed PDF validation", {
      report_id: data.report_id,
      error_count: validation.errors.length,
    });
    return { response: NextResponse.json({ error: "Stored report is invalid" }, { status: 422 }) };
  }
  return { report: validation.report };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const variant = parseVariant(request.nextUrl.searchParams.get("variant"));
    const { id } = await params;
    const loaded = await loadReport(id);
    if (loaded.response) return loaded.response;

    if (request.nextUrl.searchParams.get("debug") === "1") {
      return NextResponse.json({
        id,
        schemaVersion: loaded.report.report_version.schema_version,
        reportType: loaded.report.report_version.report_type,
        valid: true,
      });
    }
    return renderReportPdf(loaded.report, undefined, variant);
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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const branding = parsePdfBranding(body?.branding);
    const variant = parseVariant(body?.pdf_variant);
    const loaded = await loadReport(id);
    if (loaded.response) return loaded.response;
    return renderReportPdf(loaded.report, branding, variant);
  } catch (error) {
    const message = error instanceof Error && (error.message.startsWith("Logo must") || error.message.startsWith("pdf_variant"))
      ? error.message
      : "Internal server error";
    if (message !== "Internal server error") return NextResponse.json({ error: message }, { status: 400 });
    console.error("Generate branded report PDF error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
