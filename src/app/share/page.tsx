import type { Metadata } from "next";

import { SharedReportEntry } from "@/components/report/v22/shared-report-entry";

export const metadata: Metadata = {
  title: "Shared Client Report | SearchTrust",
  referrer: "no-referrer",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SharedReportPage() {
  return <SharedReportEntry />;
}
