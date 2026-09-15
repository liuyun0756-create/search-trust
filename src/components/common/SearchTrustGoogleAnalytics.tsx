"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { buildGoogleAnalyticsPageView } from "@/lib/google-analytics";

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

function analyticsClient() {
  window.dataLayer ??= [];
  window.gtag ??= (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };
  return window.gtag;
}

export function SearchTrustGoogleAnalytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const configuredMeasurementId = useRef<string | null>(null);

  useEffect(() => {
    const gtag = analyticsClient();

    if (configuredMeasurementId.current !== measurementId) {
      gtag("js", new Date());
      // SearchTrust sends sanitized page views explicitly so callback and payment
      // query parameters never leave the application.
      gtag("config", measurementId, { send_page_view: false });
      configuredMeasurementId.current = measurementId;
    }

    gtag("event", "page_view", {
      ...buildGoogleAnalyticsPageView(window.location.origin, pathname),
      page_title: document.title,
    });
  }, [measurementId, pathname]);

  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
      strategy="afterInteractive"
    />
  );
}
