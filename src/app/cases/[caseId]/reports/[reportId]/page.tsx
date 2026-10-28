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
import Link from "next/link";
import { CapabilityRepository } from "@/lib/report-capability/repository";
import { loadCapabilityOwnerDocument } from "@/lib/report-capability/owner-document";
import { CapabilityReportDocument } from "@/components/report/CapabilityReportDocument";
import { CapabilityOwnerEditor } from "@/components/report/CapabilityOwnerEditor";
import { CapabilityDeliveryActions } from "@/components/report/CapabilityDeliveryActions";
import { ImplementationRecords } from "@/components/report/ImplementationRecords";
import { isImplementationRecordsEnabled } from "@/lib/implementation-records/config";
import { isReviewWorkspaceEnabled } from "@/lib/review-workspace/config";
import { isComparisonChecksEnabled } from "@/lib/comparison-checks/config";
import { isComparisonCollectionsEnabled } from "@/lib/comparison-collections/config";
import { isGa4CollectionsEnabled } from "@/lib/ga4-comparison-collections/config";
import { isGa4SessionReadingEnabled } from "@/lib/ga4-session-readings/config";
import { isPageChecksEnabled } from "@/lib/page-checks/config";
import { isImplementationAttachmentsEnabled } from "@/lib/implementation-attachments/config";
import { ImplementationRepository } from "@/lib/implementation-records/repository";
import { uuid } from "@/lib/implementation-records/contracts";
import {isReviewDeliveryEnabled} from "@/lib/review-reports/config";
import {ReviewDeliveryRepository} from "@/lib/review-reports/repository";

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
  searchParams: Promise<{ view?: string | string[]; implementationRevision?: string | string[] }>;
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
  if (!loaded.ok) {
    if (process.env.V22_CAPABILITY_DISPATCH_ENABLED !== "true") notFound();
    if (![caseId, reportId].every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))) notFound();
    if(isReviewDeliveryEnabled()&&await new ReviewDeliveryRepository(client).report(user.userId,caseId,reportId))redirect(`/cases/${caseId}/reports/${reportId}/review`);
    const capability = await loadCapabilityOwnerDocument(new CapabilityRepository(client),
      user.userId, caseId, reportId, query.view === "client");
    if (!capability) notFound();
    const base = `/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportId)}`;
    const implementationVersions = isImplementationRecordsEnabled()
      ? await new ImplementationRepository(client).approvedVersions(user.userId, caseId, reportId) : [];
    const implementationRevision = uuid(query.implementationRevision) ? query.implementationRevision : implementationVersions[0]?.id;
    return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <div className="mx-auto mb-6 max-w-4xl space-y-4">
        <Link href={`/cases/${encodeURIComponent(caseId)}/connections`} className="text-sm font-medium underline underline-offset-4">Evidence &amp; connections</Link>
        <p className="text-sm text-[#52695b]">
          {capability.approvedRevision ? `Approved client report · Revision ${capability.approvedRevision}` : `System report · Version ${capability.version}`}
        </p>
        {capability.pendingDraft ? <p className="text-sm">A delivery draft is awaiting approval. The system report below retains the original findings and recommendations.</p> : null}
        {capability.hasApproved ? <nav aria-label="Report reading view" className="flex flex-wrap gap-4 text-sm">
          <Link href={base} aria-current={!capability.approvedRevision ? "page" : undefined} className="underline underline-offset-4">System report</Link>
          <Link href={`${base}?view=client`} aria-current={capability.approvedRevision ? "page" : undefined} className="underline underline-offset-4">Approved client report</Link>
        </nav> : null}
      </div>
      <CapabilityReportDocument document={capability.document} />
      <CapabilityDeliveryActions caseId={caseId} reportId={reportId} revision={capability.deliveryRevision} approved={capability.hasApproved}/>
      <CapabilityOwnerEditor key={reportId} initial={capability.editable} orderConstraints={capability.orderConstraints} />
      {implementationVersions.length ? <>
        <nav aria-label="Implementation record source version" className="mx-auto mt-8 flex max-w-4xl flex-wrap gap-3 text-sm">
          <span>Implementation records for approved delivery:</span>
          {implementationVersions.map(version => <Link key={version.id} href={`${base}?implementationRevision=${encodeURIComponent(version.id)}#implementation-records`} aria-current={version.id === implementationRevision ? "page" : undefined} className="underline underline-offset-4 aria-[current=page]:font-bold">Revision {version.revision}</Link>)}
        </nav>
        <ImplementationRecords key={`${user.userId}:${reportId}:${implementationRevision}`} ownerId={user.userId} attachmentsEnabled={isImplementationAttachmentsEnabled()} pageChecksEnabled={isPageChecksEnabled()} caseId={caseId} reportId={reportId} deliveryRevisionId={implementationRevision!} comparisonsEnabled={isComparisonChecksEnabled()} collectionsEnabled={isComparisonCollectionsEnabled()} ga4CollectionsEnabled={isGa4CollectionsEnabled()} ga4SessionReadingEnabled={isGa4SessionReadingEnabled()} reviewWorkspaceEnabled={isReviewWorkspaceEnabled()}/>
      </> : null}
    </main>;
  }
  const latest = await latestDeliveryPlanVersion(client, loaded.databaseId);

  const mode: ReportV22Mode = query.view === "client" ? "client" : "advisor";
  const report = mode === "client"
    ? buildDeliveryViewModel(loaded.report, "client", latest?.plan)
    : buildDeliveryViewModel(loaded.report, "advisor", latest?.plan);

  return <ReportV22Shell report={report} caseId={caseId} reportId={reportId} deliveryPlan={{ plan: latest?.plan ?? initialDeliveryPlan(loaded.report), originalPlan: initialDeliveryPlan(loaded.report), revision: latest?.revision ?? 0, status: latest?.status ?? "original", editingAvailable: true }} />;
}
