import type { MetadataRoute } from "next";
import { pageSeo, siteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    pageSeo.home.path,
    pageSeo.framework.path,
    pageSeo.sampleReport.path,
    pageSeo.useCases.path,
    pageSeo.pricing.path,
    pageSeo.terms.path,
    pageSeo.privacy.path,
    pageSeo.refund.path,
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
