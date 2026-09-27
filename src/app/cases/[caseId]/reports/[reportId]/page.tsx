import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ReportV22Shell } from "@/components/report/v22/report-v22-shell";
import { getCurrentUser } from "@/lib/auth";
import { type ReportV22Mode } from "@/lib/report-v22/view-model";
import { buildDeliveryViewModel } from "@/lib/report-delivery/projection";
import { initialDeliveryPlan } from "@/lib/report-delivery/plan";
import { latestDeliveryPlanVersion } from "@/lib/report-delivery/repository";
import { loadUserReportV22 } from "@/lib/report-v22/server-report";
import { createServerClient } from "@/lib/supabase";
import { isLocalE2ETestMode } from "@/lib/e2e-v22/config";
import { prospectReportFixture, verifiedReportFixture } from "../../../../../../e2e/fixtures/report";

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
  if (isLocalE2ETestMode()) {
    const fixture = structuredClone(reportId === "e2000000-0000-4000-8000-000000000016" ? verifiedReportFixture : prospectReportFixture);
    fixture.identity.case_id = caseId;
    fixture.report_version.report_id = reportId;
    const localMode: ReportV22Mode = query.view === "client" ? "client" : "advisor";
    const localReport = localMode === "client"
      ? buildDeliveryViewModel(fixture, "client")
      : buildDeliveryViewModel(fixture, "advisor");
    return <ReportV22Shell report={localReport} caseId={caseId} reportId={reportId} deliveryPlan={{ plan: initialDeliveryPlan(fixture), originalPlan: initialDeliveryPlan(fixture), revision: 0, status: "original", editingAvailable: false }} />;
  }
  const client = createServerClient();
  const loaded = await loadUserReportV22(client, user.userId, caseId, reportId);
  if (!loaded.ok) notFound();
  const latest = await latestDeliveryPlanVersion(client, loaded.databaseId);

  const mode: ReportV22Mode = query.view === "client" ? "client" : "advisor";
  const report = mode === "client"
    ? buildDeliveryViewModel(loaded.report, "client", latest?.plan)
    : buildDeliveryViewModel(loaded.report, "advisor", latest?.plan);

  return <ReportV22Shell report={report} caseId={caseId} reportId={reportId} deliveryPlan={{ plan: latest?.plan ?? initialDeliveryPlan(loaded.report), originalPlan: initialDeliveryPlan(loaded.report), revision: latest?.revision ?? 0, status: latest?.status ?? "original", editingAvailable: true }} />;
}
