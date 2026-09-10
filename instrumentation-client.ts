import posthog from "posthog-js";
import { shouldInitializeBrowserAnalytics } from "@/lib/security-v22/browser-analytics";

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

// Share credentials live in the URL fragment so they never enter HTTP request
// paths. Do not initialize third-party analytics on that credential-bearing page.
if (typeof window !== "undefined" && posthogToken &&
    shouldInitializeBrowserAnalytics(window.location.pathname)) {
  posthog.init(posthogToken, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    defaults: "2026-01-30",
  });
}
