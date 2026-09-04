import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ReportV22Shell } from "@/components/report/v22/report-v22-shell";
import { getCurrentUser } from "@/lib/auth";
import { buildReportV22ViewModel, type ReportV22Mode } from "@/lib/report-v22/view-model";
import { loadUserReportV22 } from "@/lib/report-v22/server-report";
import { createServerClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Local SEO Intelligence Report | SearchTrust",
  description: "A private SearchTrust v2.2 evidence-backed local search report.",
  robots: { index: false, follow: false },
};

export default async function ReportV22Page({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string; reportId: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [{ caseId, reportId }, query] = await Promise.all([params, searchParams]);
  const loaded = await loadUserReportV22(createServerClient(), user.userId, caseId, reportId);
  if (!loaded.ok) notFound();

  const mode: ReportV22Mode = query.view === "client" ? "client" : "advisor";
  const report = mode === "client"
    ? buildReportV22ViewModel(loaded.report, "client")
    : buildReportV22ViewModel(loaded.report, "advisor");

  return <ReportV22Shell report={report} caseId={caseId} reportId={reportId} />;
}
