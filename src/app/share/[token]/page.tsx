import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SharedClientReportShell } from "@/components/report/v22/shared-client-report-shell";
import { ReportShareNotFoundError } from "@/lib/report-shares/service";
import { createServerReportShareService } from "@/lib/report-shares/server";

export const metadata: Metadata = {
  title: "Shared Client Report | SearchTrust",
  referrer: "no-referrer",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const resolved = await createServerReportShareService().resolve(token);
    return <SharedClientReportShell report={resolved.report} pdfUrl={`/api/share/${token}/pdf`} />;
  } catch (error) {
    if (error instanceof ReportShareNotFoundError) notFound();
    throw error;
  }
}
