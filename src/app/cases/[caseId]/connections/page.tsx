import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { ConnectionCenter } from "@/components/google/connection-center";
import { createServerGoogleConnectionService } from "@/lib/google-connections";
import { isLocalE2ETestMode } from "@/lib/e2e-v22/config";
import { connectionCenterFixture } from "../../../../../e2e/fixtures/google";

export const metadata = { title: "Connection Center | SearchTrust", robots: { index: false, follow: false } };

export default async function ConnectionsPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (isLocalE2ETestMode()) {
    const initialData = structuredClone(connectionCenterFixture("needs_resources"));
    initialData.case.id = caseId;
    return <ConnectionCenter key={caseId} caseId={caseId} businessName={initialData.case.business_name} siteUrl={initialData.case.site_url}
      gscSyncEnabled ga4SyncEnabled gbpSyncEnabled initialData={initialData} />;
  }
  if (process.env.GOOGLE_CONNECTIONS_ENABLED !== "true") notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { data, error } = await createServerClient().from("client_cases")
    .select("id,business_name,site_url,status").eq("id", caseId).eq("user_id", user.userId).maybeSingle();
  if (error || !data || data.status !== "active") notFound();
  // Validate server configuration before presenting an authorization action.
  try { createServerGoogleConnectionService(); } catch { notFound(); }
  return <ConnectionCenter key={caseId} caseId={caseId} businessName={data.business_name} siteUrl={data.site_url}
    gscSyncEnabled={process.env.GOOGLE_GSC_SYNC_ENABLED === "true"}
    ga4SyncEnabled={process.env.GOOGLE_GA4_SYNC_ENABLED === "true"}
    gbpSyncEnabled={process.env.GOOGLE_GBP_SYNC_ENABLED === "true"} />;
}
