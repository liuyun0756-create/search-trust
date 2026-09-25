import type { Metadata } from "next";

import { IntakePaused } from "@/components/cases/intake-paused";
import { NewCaseWorkspace } from "@/components/cases/new-case-workspace";
import { isV22PublicEntryEnabled } from "@/lib/release-v22/public-entry";

export const metadata: Metadata = {
  title: "Start With One Business | SearchTrust",
  description: "Set the client scope for one evidence-backed local SEO Case. Public setup is free; a credit is used only when you start complete analysis.",
  robots: { index: false, follow: false },
};

export default function NewCasePage() {
  return isV22PublicEntryEnabled() ? <NewCaseWorkspace /> : <IntakePaused />;
}
