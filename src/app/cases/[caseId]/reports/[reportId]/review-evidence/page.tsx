import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { isReviewWorkspaceEnabled } from "@/lib/review-workspace/config";
import { parseLocation } from "@/lib/review-workspace/navigation";
import { uuid } from "@/lib/implementation-records/contracts";
import { ReviewWorkspace } from "@/components/report/review-workspace/ReviewWorkspace";
import { isDecisionWorkspaceEnabled } from "@/lib/review-decisions/config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Review evidence | SearchTrust",
  robots: { index: false, follow: false },
};
export default async function ReviewEvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string; reportId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isReviewWorkspaceEnabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const [{ caseId, reportId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const location = parseLocation(query);
  if (!uuid(caseId) || !uuid(reportId) || !location) notFound();
  return (
    <ReviewWorkspace
      key={`${user.userId}:${caseId}:${reportId}:${JSON.stringify(location)}`}
      identity={{ ownerId: user.userId, caseId, reportId }}
      location={location}
      decisionsEnabled={isDecisionWorkspaceEnabled()}
    />
  );
}
