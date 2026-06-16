"use client";

import posthog from "posthog-js";
import {
  compactAnalyticsProperties,
  type AnalyticsProperties,
} from "@/lib/analytics-properties";

export function track(event: string, properties: AnalyticsProperties = {}) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;

  try {
    posthog.capture(
      event,
      compactAnalyticsProperties({
        page_path: window.location.pathname,
        ...properties,
      })
    );
  } catch {
    // Analytics should never affect the product flow.
  }
}
