import { submitAnalysis } from "@/lib/analysis-v22/server";
import { requireV22PublicEntry } from "@/lib/release-v22/public-entry";

export const dynamic = "force-dynamic";
export const POST = requireV22PublicEntry(submitAnalysis);
