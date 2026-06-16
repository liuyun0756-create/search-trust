import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Sign In | SearchTrust",
  description: "Sign in to SearchTrust.",
  path: "/sign-in",
  noindex: true,
});

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children;
}
