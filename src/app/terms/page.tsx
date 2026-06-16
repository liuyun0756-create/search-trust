import { PolicyTabsPage } from "@/components/policy/PolicyTabsPage";
import { createPageMetadata, pageSeo } from "@/lib/seo";

export const metadata = createPageMetadata(pageSeo.terms);

export default function TermsPage() {
  return <PolicyTabsPage initialTab="terms" />;
}
