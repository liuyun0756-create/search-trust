import { isV22PublicEntryEnabled } from "@/lib/release-v22/public-entry";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createServerCaseService, type CaseResource } from "@/lib/cases";
import { CaseApiError } from "@/lib/cases/errors";
import { createServerConnectionCenterService } from "@/lib/connection-center";
import { createServerGoogleConnectionService } from "@/lib/google-connections";
import { isFirstServiceSetupAvailable } from "@/lib/first-service-setup/config";
import { isFirstServiceEntryAvailable } from "@/lib/first-service-setup/entry-config";
import { firstServiceSetupView } from "@/lib/first-service-setup/view";
import { FirstServiceConnections } from "@/components/cases/first-service-connections";
import { CapabilityRepository } from "@/lib/report-capability/repository";
import { createServerClient } from "@/lib/supabase";
import { isPlanningSettingsEnabled } from "@/lib/planning-settings/config";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Prepare client data | SearchTrust",
  robots: { index: false, follow: false },
};

export default async function ServiceSetupPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  if (!isFirstServiceSetupAvailable()) notFound();
  const { caseId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      caseId,
    )
  )
    notFound();
  const user = await getCurrentUser();
  if (!user)
    redirect(
      `/sign-in?redirect_url=${encodeURIComponent(`/cases/${caseId}/service-setup`)}`,
    );
  let client: CaseResource;
  try {
    client = await createServerCaseService().get(user.userId, caseId);
  } catch (error) {
    if (error instanceof CaseApiError && error.code === "CASE_NOT_FOUND")
      notFound();
    throw error;
  }
  if (client.status !== "active") notFound();
  if (process.env.V22_CAPABILITY_DISPATCH_ENABLED === "true") {
    const completed = await new CapabilityRepository(
      createServerClient(),
    ).listCompletedReports(user.userId);
    const report = completed.find((item) => item.caseId === caseId);
    if (report) redirect(`/cases/${caseId}/reports/${report.reportId}`);
  }
  // Validate OAuth configuration before offering authorization. This page does not
  // reserve credit, dispatch a report, or treat source health as an intake receipt.
  createServerGoogleConnectionService();
  const connections = await createServerConnectionCenterService().get(
    user.userId,
    caseId,
  );
  if (connections.coverage.parent_report_id)
    redirect(`/cases/${caseId}/connections`);
  const view = firstServiceSetupView(client, connections);
  return (
    <main className="min-h-screen bg-[#f7faf7] px-5 py-12 text-[#1d2a22] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap gap-6 text-sm font-semibold underline">
          <Link href="/cases/service/prepare">← Choose another client</Link>
          <Link href="/reports">Your reports</Link>
        </div>
        <FirstServiceConnections
          intakeEnabled={isV22PublicEntryEnabled()}
          view={view}
          planningEnabled={isPlanningSettingsEnabled()}
          entryOwnerId={
            isFirstServiceEntryAvailable() ? user.userId : undefined
          }
          gscSyncEnabled={process.env.GOOGLE_GSC_SYNC_ENABLED === "true"}
          ga4SyncEnabled={process.env.GOOGLE_GA4_SYNC_ENABLED === "true"}
        />
      </div>
    </main>
  );
}
