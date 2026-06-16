import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/checkout/",
        "/reports/",
        "/sign-in/",
        "/test-report/",
        "/webhook/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
