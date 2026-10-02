import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

import { RunAuditButton } from "@/components/common/RunAuditButton";
import { MethodOverview, MethodProspect } from "./MethodIntro";
import { MethodJourney } from "./MethodJourney";
import { MethodNavigation } from "./MethodNavigation";
import { MethodCaseFile, MethodStageBand, MethodStageHandoff } from "./MethodCaseFile";
import { MethodVerified } from "./MethodVerified";
import { MethodPrioritization } from "./MethodPrioritization";
import { MethodExecution } from "./MethodExecution";
import { MethodPractice } from "./MethodPractice";
import { MethodDelivery } from "./MethodDelivery";
import { methodFAQ } from "./method-content";
import "./method-design.css";

export function MethodV22() {
  return (
    <div className="method-design bg-[#f3f4ed] text-[#182018]">
      <MethodOverview />

      <MethodJourney>
        <MethodNavigation />
        <div className="method-case-workspace">
          <div className="method-case-main">
            <div data-method-stage="prospect"><MethodStageBand id="prospect-diagnosis" /><MethodProspect /><MethodStageHandoff from="prospect-diagnosis" to="verified-action" /></div>
            <div data-method-stage="verify"><MethodStageBand id="verified-action" /><MethodVerified /><MethodStageHandoff from="verified-action" to="prioritization-title" /></div>
            <div data-method-stage="prioritize"><MethodStageBand id="prioritization-title" /><MethodPrioritization /><MethodStageHandoff from="prioritization-title" to="execution-title" /></div>
            <div data-method-stage="execute"><MethodStageBand id="execution-title" /><MethodExecution /><MethodStageHandoff from="execution-title" to="practice-title" /></div>
            <div data-method-stage="review"><MethodStageBand id="practice-title" /><MethodPractice /><MethodStageHandoff from="practice-title" to="delivery-title" /></div>
            <div data-method-stage="deliver"><MethodStageBand id="delivery-title" /><MethodDelivery /></div>
          </div>
          <MethodCaseFile />
        </div>
      </MethodJourney>

      <section className="bg-white px-5 py-8 sm:px-8"><details className="method-more mx-auto max-w-7xl"><summary>Official method reference index</summary>
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#637e16]">Method references</p><h2 className="mt-4 font-[family-name:Georgia] text-3xl tracking-[-0.03em]">Grounded in documented SEO practice.</h2><p className="mt-4 text-sm leading-7 text-[#586452]">These sources explain the underlying practice. They are not an endorsement of SearchTrust or a validation of its proprietary model.</p></div>
          <ul className="divide-y divide-[#d8ddcf] border-y border-[#d8ddcf]">
            {[
              ["Using Search Console and Analytics together", "Search performance, on-site behavior and why the totals can differ.", "https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console"],
              ["Investigating search traffic changes", "Consider technical issues, demand, seasonality and ranking changes.", "https://developers.google.com/search/docs/monitor-debug/debugging-search-traffic-drops"],
              ["Understanding local ranking", "Relevance, distance and prominence provide essential local context.", "https://support.google.com/business/answer/7091?hl=en"],
            ].map(([title, description, href]) => <li key={href} className="py-5"><a href={href} className="inline-flex items-center gap-2 text-sm font-bold underline decoration-[#b6c799] underline-offset-4 hover:text-[#637e16]">{title}<ArrowRight className="h-4 w-4 shrink-0" /></a><p className="mt-2 text-sm leading-6 text-[#586452]">{description}</p></li>)}
          </ul>
        </div>
      </details></section>
    </div>
  );
}

export function MethodFAQ() {
  return (
    <section className="bg-[#f3f4ed] px-5 py-16 text-[#182018] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-[family-name:Georgia] text-4xl tracking-[-0.04em] sm:text-5xl">Questions about the method</h2>
        <div className="mt-9 divide-y divide-[#d8ddcf] border-y border-[#d8ddcf]">
          {methodFAQ.map(({ question, answer }) => (
            <details key={question} className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-base font-bold leading-7 marker:hidden [&::-webkit-details-marker]:hidden">{question}<ChevronDown className="mt-1 h-5 w-5 shrink-0 text-[#637e16] transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
              <p className="pb-6 text-sm leading-7 text-[#586452]">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MethodCTA() {
  return (
    <section className="bg-[#f3f4ed] px-5 py-16 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 rounded-[2rem] bg-[#b8e626] p-7 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl"><h2 className="font-[family-name:Georgia] text-4xl leading-tight tracking-[-0.04em]">Bring a real business.<br />Start an evidence-backed SEO recommendation.</h2><p className="mt-5 text-base leading-7 text-[#344621]">Begin with the website and business confirmation, then move into analysis. Review the initial work direction and test it further when the client connects their data.</p><p className="mt-4 text-sm leading-7 text-[#344621]">Website entry and business confirmation are free. New accounts receive 5 permanent credits; starting a Prospect analysis or generating a Verified Action Plan uses 1 credit. This button opens the entry flow; it does not start paid generation.</p></div>
        <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto">
          <RunAuditButton trackingSource="method_footer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#172018] px-6 py-4 text-sm font-bold text-white hover:bg-[#30402b] focus-visible:outline-2 focus-visible:outline-offset-4">Analyze a business <ArrowRight aria-hidden="true" className="h-4 w-4" /></RunAuditButton>
          <Link href="/sample-report#report-scenarios" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#172018]/25 px-6 py-3 text-sm font-bold hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-4">See the full report sample first</Link>
        </div>
      </div>
    </section>
  );
}
