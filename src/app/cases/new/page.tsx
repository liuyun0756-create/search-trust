import type { Metadata } from "next";

import { IntakePaused } from "@/components/cases/intake-paused";
import { NewCaseWorkspace } from "@/components/cases/new-case-workspace";
import { isV22PublicEntryEnabled } from "@/lib/release-v22/public-entry";

export const metadata: Metadata = {
  title: "Start a Free Local SEO Preflight | SearchTrust",
  description: "Confirm a local business, its real competitors, and available evidence before creating a SearchTrust Case.",
  robots: { index: false, follow: false },
};

export default function NewCasePage() {
  return isV22PublicEntryEnabled() ? <NewCaseWorkspace /> : <IntakePaused />;
}
