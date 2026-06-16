import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Test Report | SearchTrust",
  description: "Internal SearchTrust report generation test page.",
  path: "/test-report",
  noindex: true,
});

export default function TestReportLayout({ children }: { children: ReactNode }) {
  return children;
}
