import { PolicyTabsPage } from "@/components/policy/PolicyTabsPage";
import { createPageMetadata, pageSeo } from "@/lib/seo";

export const metadata = createPageMetadata(pageSeo.privacy);

export default function PrivacyPage() {
  return <PolicyTabsPage initialTab="privacy" />;
}
