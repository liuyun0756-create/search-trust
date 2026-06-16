"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

export function AnalyticsIdentify() {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;

    try {
      if (isSignedIn && user?.id) {
        posthog.identify(user.id);
        return;
      }

      posthog.reset();
    } catch {
      // Analytics identity should not affect auth or rendering.
    }
  }, [isLoaded, isSignedIn, user?.id]);

  return null;
}
