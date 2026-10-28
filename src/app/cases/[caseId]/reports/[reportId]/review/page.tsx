import { MetricReviewGuide } from "@/components/report/metric-review/MetricReviewGuide";
import metricStyles from "@/components/report/metric-review/metric-review.module.css";
import { ReportDifferencePanel } from "@/components/report/review-differences/ReportDifferencePanel";
import { ReportDifferenceRepository } from "@/lib/review-differences/repository";
import { isReportDifferencesEnabled } from "@/lib/review-differences/config";
import type { ReportDifference } from "@/lib/review-differences/types";
import Link from "next/link";
import { ImplementationRecords } from "@/components/report/ImplementationRecords";
import { ImplementationRepository } from "@/lib/implementation-records/repository";
import { isMultiRoundReviewsEnabled } from "@/lib/review-intake/multi-round-config";
import { isComparisonChecksEnabled } from "@/lib/comparison-checks/config";
import { isComparisonCollectionsEnabled } from "@/lib/comparison-collections/config";
import { isGa4CollectionsEnabled } from "@/lib/ga4-comparison-collections/config";
import { isGa4SessionReadingEnabled } from "@/lib/ga4-session-readings/config";
import { isPageChecksEnabled } from "@/lib/page-checks/config";
import { isImplementationAttachmentsEnabled } from "@/lib/implementation-attachments/config";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { isReviewDeliveryEnabled } from "@/lib/review-reports/config";
import { ReviewDeliveryRepository } from "@/lib/review-reports/repository";
import { initialReviewRevision, uuid } from "@/lib/review-reports/delivery";
import { projectReviewPreview } from "@/lib/review-reports/projection";
import { ReviewDocument } from "@/components/report/review-delivery/ReviewDocument";
import { ReviewEditor } from "@/components/report/review-delivery/ReviewEditor";
import { CapabilityDeliveryActions } from "@/components/report/CapabilityDeliveryActions";
export const metadata = {
  title: "Review your Verified Action Plan | SearchTrust",
  robots: { index: false, follow: false },
};
export default async function ReviewReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string; reportId: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!isReviewDeliveryEnabled()) notFound();
  const { caseId, reportId } = await params,
    query = await searchParams;
  if (
    ![caseId, reportId].every(uuid) ||
    (query.revision && !uuid(query.revision))
  )
    notFound();
  const repo = new ReviewDeliveryRepository(createServerClient()),
    r = await repo.report(user.userId, caseId, reportId);
  if (!r) notFound();
  const showDifferences = isReportDifferencesEnabled();
  let difference: ReportDifference | null = null,
    differenceUnavailable = false;
  if (showDifferences) {
    try {
      difference = await new ReportDifferenceRepository(repo.db).read(
        user.userId,
        caseId,
        r,
      );
    } catch {
      differenceUnavailable = true;
    }
  }
  const [latest, history] = await Promise.all([
    repo.revision(user.userId, caseId, r),
    repo.history(user.userId, caseId, reportId),
  ]);
  const selected =
    query.revision && query.revision !== latest?.id
      ? await repo.revision(user.userId, caseId, r, query.revision)
      : latest;
  if (query.revision && !selected) notFound();
  const historical = !!selected && selected.id !== latest?.id;
  const multiRound = isMultiRoundReviewsEnabled();
  const approvedVersions = multiRound
    ? await new ImplementationRepository(repo.db).approvedVersions(
        user.userId,
        caseId,
        reportId,
      )
    : [];
  const implementationRevision =
    selected?.status === "approved" ? selected.id : approvedVersions[0]?.id;
  const content = selected?.content ?? initialReviewRevision(r),
    preview = projectReviewPreview(
      r,
      content,
      selected?.revision ?? 0,
      selected?.id,
    ),
    base = `/cases/${caseId}/reports/${reportId}/review`;
  return (
    <main className="min-h-screen bg-[#f6f9f3] px-4 py-8 text-[#203d32] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <Link
              href="/reports"
              className="text-sm underline underline-offset-4"
            >
              ← All Case reports
            </Link>
            <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-[#63865c]">
              Verified review / version {r.version}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Prepare your next client conversation.
            </h1>
            <p className="mt-3 text-sm text-[#617469]">
              Review the evidence, refine the next work and approve one version
              to deliver.
            </p>
          </div>
          <span className="rounded-full border border-[#adc69e] bg-[#e7f1df] px-5 py-3 text-sm font-semibold">
            {selected
              ? `${selected.status === "approved" ? "Approved" : "Draft"} revision ${selected.revision}`
              : "Ready for your review"}
          </span>
        </header>
        {showDifferences ? (
          <ReportDifferencePanel
            difference={difference}
            unavailable={differenceUnavailable}
          />
        ) : null}
        {r.content.seo_actions.length ? <section aria-label="Review metrics before your next plan" className={metricStyles.report}>
          <h2>Review the numbers before choosing the next work.</h2><p>These readings use the evidence fixed in this report. Delivery edits do not change the observations.</p>
          {r.content.seo_actions.map((a, i) => <details key={a.facts.action_id} open={i === 0}><summary>{String(i + 1).padStart(2, "0")} / {a.facts.title}</summary><MetricReviewGuide action={a.facts}/></details>)}
        </section> : null}
        <nav
          aria-label="Delivery version history"
          className="mb-6 flex flex-wrap gap-3 text-sm"
        >
          <Link
            href={base}
            className="rounded-lg border border-[#cbd9cb] px-3 py-2"
          >
            Latest saved version
          </Link>
          {!historical ? (
            <a
              href="#review-delivery-editor"
              className="rounded-lg bg-[#244633] px-3 py-2 text-white lg:hidden"
            >
              Review &amp; approve ↓
            </a>
          ) : null}
          {history.map((h) => (
            <Link
              key={h.id}
              href={`${base}?revision=${h.id}`}
              aria-current={selected?.id === h.id ? "page" : undefined}
              className="rounded-lg border border-[#cbd9cb] px-3 py-2 aria-[current=page]:bg-[#244633] aria-[current=page]:text-white"
            >
              Revision {h.revision} · {h.status}
            </Link>
          ))}
        </nav>
        {historical ? (
          <p className="mb-5 rounded-xl border border-[#cbd9cb] bg-white p-4 text-sm">
            Historical revision · read only. Open the latest saved version to
            edit or create a new delivery.
          </p>
        ) : null}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,390px)]">
          <div className="min-w-0">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#617469]">
              {selected?.status === "approved"
                ? "Approved client report"
                : "Saved delivery preview · approval required"}
            </p>
            <ReviewDocument document={preview} />
            <details className="mt-6 rounded-xl border border-[#dce6d9] bg-white p-5">
              <summary className="cursor-pointer font-semibold">
                Internal SEO decision record
              </summary>
              <p className="mt-3 text-xs text-[#617469]">
                For your review. These reasons and completion statements are not
                included in the client report.
              </p>
              {[
                ...r.content.seo_actions.flatMap((a) =>
                  a.selected_decision ? [a.selected_decision] : [],
                ),
                ...r.content.seo_new_decisions,
              ].map((d) => (
                <section
                  key={d.action_id}
                  className="mt-4 border-t pt-4 text-sm"
                >
                  <p className="font-semibold">
                    {d.action_id} · {d.disposition}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words">
                    {d.reason}
                  </p>
                  {d.completion_statement ? (
                    <p className="mt-2">{d.completion_statement}</p>
                  ) : null}
                  {d.reconsider_when ? (
                    <p className="mt-2">Reconsider: {d.reconsider_when}</p>
                  ) : null}
                </section>
              ))}
            </details>
          </div>
          <aside
            id="review-delivery-editor"
            className="min-w-0 scroll-mt-6 space-y-6"
          >
            {!historical ? (
              <>
                <ReviewEditor
                  key={`${reportId}:${latest?.revision ?? 0}`}
                  initial={{
                    ...(latest?.content ?? initialReviewRevision(r)),
                    expected_revision: latest?.revision ?? 0,
                  }}
                />
                <CapabilityDeliveryActions
                  caseId={caseId}
                  reportId={reportId}
                  revision={latest?.revision ?? 0}
                  approved={latest?.status === "approved"}
                  pathPrefix="/review"
                />
              </>
            ) : null}
          </aside>
        </div>
        {multiRound && approvedVersions.length > 0 ? (
          <section
            className="mt-10 border-t border-[#dce6d9] pt-8"
            aria-labelledby="next-round-heading"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-[#63865c]">
              Next review cycle
            </p>
            <h2 id="next-round-heading" className="mt-2 text-2xl font-semibold">
              Record the work. Prepare your next review.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#617469]">
              Start from this report’s approved plan. Record what you implement,
              check the relevant page and data, then save the evidence and your
              next decisions. These records are free; generating another review
              requires a separate 1-credit confirmation.
            </p>
            <nav
              aria-label="Approved plan for next review"
              className="mt-4 flex flex-wrap gap-3 text-sm"
            >
              {approvedVersions.map((v) => (
                <Link
                  key={v.id}
                  href={`${base}?revision=${v.id}#implementation-records`}
                  aria-current={
                    v.id === implementationRevision ? "page" : undefined
                  }
                  className="rounded-lg border border-[#cbd9cb] px-3 py-2 aria-[current=page]:bg-[#244633] aria-[current=page]:text-white"
                >
                  Approved revision {v.revision}
                </Link>
              ))}
            </nav>
            <ImplementationRecords
              key={`${user.userId}:${reportId}:${implementationRevision}`}
              ownerId={user.userId}
              caseId={caseId}
              reportId={reportId}
              deliveryRevisionId={implementationRevision!}
              attachmentsEnabled={isImplementationAttachmentsEnabled()}
              pageChecksEnabled={isPageChecksEnabled()}
              comparisonsEnabled={isComparisonChecksEnabled()}
              collectionsEnabled={isComparisonCollectionsEnabled()}
              ga4CollectionsEnabled={isGa4CollectionsEnabled()}
              ga4SessionReadingEnabled={isGa4SessionReadingEnabled()}
              reviewWorkspaceEnabled={true}
            />
          </section>
        ) : multiRound ? (
          <p className="mt-8 rounded-xl bg-white p-5 text-sm">
            Approve a saved delivery version to begin the next implementation
            and review cycle.
          </p>
        ) : null}
      </div>
    </main>
  );
}
