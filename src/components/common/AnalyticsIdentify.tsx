"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

import { useAppUser } from "@/lib/client-auth";

export function AnalyticsIdentify() {
  const { isLoaded, isSignedIn, user } = useAppUser();

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
