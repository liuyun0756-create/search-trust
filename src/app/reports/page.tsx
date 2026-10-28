import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileSearch, Plus } from "lucide-react";

import { groupReportsByCase, ReportCaseWorkspace, type ReportWorkspaceItem } from "@/components/report/report-case-workspace";
import { getCurrentUser } from "@/lib/auth";
import { validateReportV22 } from "@/lib/report-v22";
import { createServerClient } from "@/lib/supabase";
import { CapabilityRepository } from "@/lib/report-capability/repository";
import {ReviewDeliveryRepository} from "@/lib/review-reports/repository";
import {isReviewDeliveryEnabled} from "@/lib/review-reports/config";

// Private user data is resolved per request, including in the isolated browser build.
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const client = createServerClient();
  const { data, error } = await client
    .from("reports")
    .select("id, report_id, case_id, report_type, version_number, generated_at, completed_at, created_at, report_v2_2")
    .eq("user_id", user.userId)
    .not("case_id", "is", null)
    .not("report_v2_2", "is", null)
    .order("created_at", { ascending: false });

  const reports: ReportWorkspaceItem[] = (data ?? []).flatMap((row) => {
    const validation = validateReportV22(row.report_v2_2);
    if (!validation.ok || !row.case_id) return [];
    const report = validation.report;
    return [{
      caseId: row.case_id,
      reportId: row.report_id || report.report_version.report_id,
      businessName: report.identity.business.business_name,
      siteUrl: report.identity.business.site_url,
      market: report.case_context.target_market.display_name,
      service: report.case_context.primary_service,
      type: report.report_version.report_type,
      version: report.report_version.version_number,
      generatedAt: report.report_version.generated_at || row.generated_at || row.completed_at || row.created_at,
    }];
  });

  let capabilityError = false;
  if (process.env.V22_CAPABILITY_DISPATCH_ENABLED === "true") {
    try { reports.push(...await new CapabilityRepository(client).listCompletedReports(user.userId)); }
    catch { capabilityError = true; }
  }
  if(isReviewDeliveryEnabled()){try{reports.push(...await new ReviewDeliveryRepository(client).list(user.userId));}catch{capabilityError=true;}}
  const failed = Boolean(error) || capabilityError;
  const cases = groupReportsByCase(reports);

  return (
    <main className="min-h-screen bg-[#f7faf7] text-[#1d2a22]">
      <section className="border-b border-[#e5ebe4] bg-white px-5 py-10 sm:px-8 lg:px-12 lg:py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[#668a50]"><span className="h-1.5 w-1.5 rounded-full bg-[#9bc96f]" aria-hidden="true" /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Private report workspace</span></div>
            <h1 className="text-[38px] font-black leading-[1.04] tracking-[-0.06em] sm:text-[50px]">Client Case workspace</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6c7b70]">Follow each business from the first prospect diagnosis to a verified action plan. Every generated version, evidence review and client deliverable stays attached to the same Case.</p>
          </div>
          <Link href="/cases/new" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#26432e] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#365d40]"><Plus className="h-4 w-4" /> Start a new Case</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-9 sm:px-8 lg:px-12 lg:py-12">
        {failed ? <div role="alert" className="rounded-2xl border border-[#ead7c5] bg-[#fff8ee] p-5 text-sm font-bold text-[#8f5422]">Reports could not be loaded. Please refresh and try again.</div> : null}
        {!failed && reports.length === 0 ? (
          <div className="rounded-2xl border border-[#e3eae2] bg-white px-6 py-14 text-center sm:px-12">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#e7f2e2] text-[#65974e]"><FileSearch className="h-5 w-5" /></span>
            <h2 className="mt-6 text-2xl font-black tracking-[-0.04em]">No V2.2 reports yet</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#717b6f]">Start with a free public-data preflight. Once the Case finishes analysis, its report will appear here.</p>
            <Link href="/cases/new" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#26432e] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#365d40]">Start free preflight <ArrowRight className="h-4 w-4" /></Link>
          </div>
        ) : null}

        {!failed && reports.length > 0 ? <ReportCaseWorkspace cases={cases} /> : null}
      </section>
    </main>
  );
}
