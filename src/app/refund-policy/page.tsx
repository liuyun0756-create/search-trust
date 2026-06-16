import { PolicyTabsPage } from "@/components/policy/PolicyTabsPage";
import { createPageMetadata, pageSeo } from "@/lib/seo";

export const metadata = createPageMetadata(pageSeo.refund);

export default function RefundPolicyPage() {
  return <PolicyTabsPage initialTab="refunds" />;
}
