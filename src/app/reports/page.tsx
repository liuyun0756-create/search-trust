import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileSearch, Plus, ShieldCheck } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { validateReportV22 } from "@/lib/report-v22";
import { createServerClient } from "@/lib/supabase";

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { data, error } = await createServerClient()
    .from("reports")
    .select("id, report_id, case_id, report_type, version_number, generated_at, completed_at, created_at, report_v2_2")
    .eq("user_id", user.userId)
    .not("case_id", "is", null)
    .not("report_v2_2", "is", null)
    .order("created_at", { ascending: false });

  const reports = (data ?? []).flatMap((row) => {
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

  return (
    <main className="min-h-screen bg-[#f4f1e8] text-[#172019]">
      <section className="relative overflow-hidden border-b border-white/10 bg-[#172019] px-5 py-14 text-white sm:px-8 lg:px-12 lg:py-20">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:42px_42px]" aria-hidden="true" />
        <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-[#a5d020]/10 blur-[90px]" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-5 flex items-center gap-2 text-[#b8dd3c]"><ShieldCheck className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.22em]">Private report workspace</span></div>
            <h1 className="text-[48px] font-black leading-none tracking-[-0.06em] sm:text-[64px]">Your reports</h1>
            <p className="mt-5 max-w-2xl text-sm font-medium leading-6 text-white/55">Every report shown here belongs to a V2.2 Case and keeps its evidence, actions, PDF and client-share context together.</p>
          </div>
          <Link href="/cases/new" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#a5d020] px-6 py-3.5 text-sm font-black text-[#172019] transition hover:bg-[#b8dd3c]"><Plus className="h-4 w-4" /> Start a new Case</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        {error ? <div role="alert" className="rounded-2xl border border-[#ead7c5] bg-[#fff8ee] p-5 text-sm font-bold text-[#8f5422]">Reports could not be loaded. Please refresh and try again.</div> : null}
        {!error && reports.length === 0 ? (
          <div className="rounded-[28px] border border-[#dfe1d8] bg-white px-6 py-16 text-center shadow-[0_22px_60px_rgba(35,48,36,0.06)] sm:px-12">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf3e2] text-[#78931c]"><FileSearch className="h-6 w-6" /></span>
            <h2 className="mt-6 text-2xl font-black tracking-[-0.04em]">No V2.2 reports yet</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#717b6f]">Start with a free public-data preflight. Once the Case finishes analysis, its report will appear here.</p>
            <Link href="/cases/new" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#172019] px-6 py-3 text-sm font-black text-white">Start free preflight <ArrowRight className="h-4 w-4" /></Link>
          </div>
        ) : null}

        {!error && reports.length > 0 ? (
          <div className="grid gap-4">
            {reports.map((report) => (
              <Link
                key={`${report.caseId}-${report.reportId}`}
                href={`/cases/${encodeURIComponent(report.caseId)}/reports/${encodeURIComponent(report.reportId)}`}
                className="group grid gap-5 rounded-[24px] border border-[#dfe1d8] bg-white p-6 shadow-[0_14px_36px_rgba(35,48,36,0.04)] transition hover:-translate-y-0.5 hover:border-[#b7ca79] hover:shadow-[0_20px_46px_rgba(35,48,36,0.09)] md:grid-cols-[1fr_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#78931c]"><span>V{report.version}</span><span className="text-[#b0b7ad]">/</span><span>{report.type === "prospect" ? "Prospect" : "Verified"}</span><span className="text-[#b0b7ad]">/</span><span>{displayDate(report.generatedAt)}</span></div>
                  <h2 className="mt-3 truncate text-2xl font-black tracking-[-0.04em] text-[#172019]">{report.businessName}</h2>
                  <p className="mt-2 truncate text-sm font-medium text-[#788176]">{report.service} · {report.market} · {report.siteUrl}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#586355] transition group-hover:text-[#78931c]">Open report <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
