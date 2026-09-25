import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Sign In | SearchTrust",
  description: "Sign in to your private SearchTrust Case workspace and continue evidence-backed local SEO client work.",
  path: "/sign-in",
  noindex: true,
});

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children;
}
