import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { uuid } from "@/lib/implementation-records/contracts";
import { isDecisionWorkspaceEnabled } from "@/lib/review-decisions/config";
import { parseLocation } from "@/lib/review-decisions/draft";
import { isReviewGenerationEnabled } from "@/lib/review-intake/config";
import { DecisionWorkspace } from "@/components/report/review-decisions/DecisionWorkspace";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your review decisions | SearchTrust",
  robots: { index: false, follow: false },
};
export default async function DecisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string; reportId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isDecisionWorkspaceEnabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const [{ caseId, reportId }, query] = await Promise.all([
      params,
      searchParams,
    ]),
    location = parseLocation(query);
  if (!uuid(caseId) || !uuid(reportId) || !location) notFound();
  return (
    <DecisionWorkspace
      key={`${user.userId}:${caseId}:${reportId}:${location.reviewId}:${location.decisionId ?? ""}`}
      identity={{ ownerId: user.userId, caseId, reportId }}
      reviewId={location.reviewId}
      decisionId={location.decisionId}
      generationEnabled={isReviewGenerationEnabled()}
    />
  );
}
