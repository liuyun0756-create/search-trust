import Link from "next/link";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, FileSearch, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { isLocalE2ETestMode } from "@/lib/e2e-v22/config";
import { validateReportV22 } from "@/lib/report-v22";
import { createServerClient } from "@/lib/supabase";
import { isFirstServiceSetupEnabled } from "@/lib/first-service-setup/config";
import { E2E_IDS } from "../../../../e2e/fixtures/ids";

export const metadata = {
  title: "Continue client work | SearchTrust",
  robots: { index: false, follow: false },
};

type ClientCase = {
  id: string;
  business_name: string;
  site_url: string;
  primary_service: string;
  updated_at: string;
};

async function eligibleCases(userId: string) {
  if (isLocalE2ETestMode()) return {
    cases: [{ id: E2E_IDS.caseId, business_name: "SearchTrust E2E Plumbing", site_url: E2E_IDS.siteUrl, primary_service: "Plumbing", updated_at: new Date().toISOString() }],
    error: false,
  };
  const db = createServerClient();
  const { data: cases, error: casesError } = await db.from("client_cases")
    .select("id,business_name,site_url,primary_service,updated_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (casesError) return { cases: [] as ClientCase[], error: true };
  if (!cases?.length) return { cases: [] as ClientCase[], error: false };

  const { data: reports, error: reportsError } = await db.from("reports")
    .select("id,case_id,report_v2_2")
    .eq("user_id", userId)
    .eq("report_type", "prospect")
    .eq("status", "paid_full")
    .in("case_id", cases.map((item) => item.id));
  if (reportsError) return { cases: [] as ClientCase[], error: true };

  const readyIds = new Set((reports ?? []).flatMap((row) => {
    const validation = validateReportV22(row.report_v2_2);
    return validation.ok
      && validation.report.report_version.report_type === "prospect"
      && validation.report.identity.case_id === row.case_id
      && validation.report.report_version.report_id === row.id
      ? [row.case_id as string]
      : [];
  }));
  return {
    cases: (cases as ClientCase[]).filter((item) => readyIds.has(item.id)),
    error: false,
  };
}

export default async function ServiceClientEntryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Fcases%2Fservice");
  const result = await eligibleCases(user.userId);
  const connectionsEnabled = isLocalE2ETestMode() || process.env.GOOGLE_CONNECTIONS_ENABLED === "true";
  const preparationEnabled = isFirstServiceSetupEnabled();

  return (
    <main className="min-h-screen bg-[#f7faf7] px-4 py-12 text-[#1d2a22] sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <Link href="/#choose-work" className="inline-flex items-center gap-2 text-sm font-semibold text-[#4b6f53] hover:text-[#24462f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#24462f]"><ArrowLeft size={16} aria-hidden="true" /> Back to work choices</Link>
        <div className="mt-10 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#668a50]">SERVICE / EXISTING CLIENT CASE</p>
          <h1 className="mt-4 font-[family-name:Georgia] text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] tracking-[-0.05em]">Continue the work with a client.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#657267]">Choose a Case you started during the sales stage. Its public diagnosis stays attached while you add the client’s Search Console and GA4 evidence. Choosing a Case does not use a credit.</p>
        </div>

        <section aria-labelledby="existing-cases-heading" className="mt-12 rounded-[1.75rem] border border-[#dce6d9] bg-white p-5 shadow-[0_20px_65px_rgba(30,54,36,0.05)] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.17em] text-[#78966e]">YOUR CLIENT WORK</p>
              <h2 id="existing-cases-heading" className="mt-2 text-2xl font-bold tracking-[-0.04em]">Cases ready for service</h2>
            </div>
            <BriefcaseBusiness className="text-[#729878]" size={26} strokeWidth={1.7} aria-hidden="true" />
          </div>

          {result.error ? <p role="alert" className="mt-7 rounded-xl bg-[#fff5e8] p-4 text-sm font-semibold text-[#86552f]">Client Cases could not be loaded. Please refresh and try again.</p> : null}
          {!result.error && result.cases.length === 0 ? (
            <div className="mt-7 rounded-xl bg-[#f3f7f2] p-6 sm:p-8">
              <FileSearch size={25} className="text-[#6d9872]" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-bold">No completed Prospect Case yet</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657267]">This list shows Cases with a completed Prospect report. If you began one in this browser, return to that draft to finish it. A client who was already signed before using SearchTrust needs the separate direct-service workflow described below.</p>
            </div>
          ) : null}
          {!result.error && result.cases.length > 0 ? (
            <ul className="mt-6 grid gap-3">
              {result.cases.map((item) => (
                <li key={item.id} className="flex flex-col gap-4 rounded-xl border border-[#e1e9df] bg-[#fbfdfb] p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-bold tracking-[-0.025em]">{item.business_name}</p>
                    <p className="mt-1 text-sm text-[#617063]">{item.primary_service}</p>
                    <p className="mt-1 break-all text-xs text-[#8a998d]">{item.site_url}</p>
                  </div>
                  {connectionsEnabled ? (
                    <Link href={`/cases/${encodeURIComponent(item.id)}/connections`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#26432e] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#365d40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26432e]">Continue service <ArrowRight size={16} aria-hidden="true" /></Link>
                  ) : <span className="text-sm font-semibold text-[#7a897c]">Client connections are temporarily unavailable</span>}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section aria-labelledby="direct-service-heading" className="mt-5 flex flex-col gap-5 rounded-[1.5rem] bg-[#eaf2e9] p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#5b8363]">A DIFFERENT STARTING POINT</p>
            <h2 id="direct-service-heading" className="mt-2 text-xl font-bold tracking-[-0.03em]">Already serving this client, but no Prospect Case exists?</h2>
            <p className="mt-2 text-sm leading-6 text-[#5f7062]">{preparationEnabled
              ? "Save your existing client and prepare its Search Console and GA4 connections without buying a Prospect report. Preparation uses no credit. Paid first-service analysis is not available yet."
              : "The direct-service path must create its own first service diagnosis. It cannot reuse a fictional sales report or charge for a Prospect analysis you did not ask for. We are keeping that path unavailable until the report and credit flow support it end to end."}</p>
            {preparationEnabled && <Link href="/cases/service/prepare" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#26432e] px-4 py-2 text-sm font-semibold text-white">Prepare an existing client · no credit <ArrowRight size={16} aria-hidden="true" /></Link>}
          </div>
          <LockKeyhole size={23} className="shrink-0 text-[#709176]" aria-hidden="true" />
        </section>
      </div>
    </main>
  );
}
