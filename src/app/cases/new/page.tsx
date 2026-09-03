import type { Metadata } from "next";

import { NewCaseWorkspace } from "@/components/cases/new-case-workspace";

export const metadata: Metadata = {
  title: "Start a Free Local SEO Preflight | SearchTrust",
  description: "Confirm a local business, its real competitors, and available evidence before creating a SearchTrust Case.",
  robots: { index: false, follow: false },
};

export default function NewCasePage() {
  return <NewCaseWorkspace />;
}
