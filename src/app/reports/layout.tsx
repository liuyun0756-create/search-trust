import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Reports | SearchTrust",
  description: "Private SearchTrust report workspace.",
  path: "/reports",
  noindex: true,
});

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return children;
}
