import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { GoogleResourceSelector } from "@/components/google/google-resource-selector";
import { createServerGoogleConnectionService } from "@/lib/google-connections";

export const metadata = { title: "Choose Google resources | SearchTrust", robots: { index: false, follow: false } };

export default async function ConnectionsPage({ params }: { params: Promise<{ caseId: string }> }) {
  if (process.env.GOOGLE_CONNECTIONS_ENABLED !== "true") notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { caseId } = await params;
  const { data, error } = await createServerClient().from("client_cases")
    .select("id,business_name,site_url,status").eq("id", caseId).eq("user_id", user.userId).maybeSingle();
  if (error || !data || data.status !== "active") notFound();
  // Validate server configuration before presenting an authorization action.
  try { createServerGoogleConnectionService(); } catch { notFound(); }
  return <GoogleResourceSelector caseId={caseId} businessName={data.business_name} siteUrl={data.site_url} />;
}
