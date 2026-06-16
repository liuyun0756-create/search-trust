import { PostHog } from "posthog-node";
import {
  compactAnalyticsProperties,
  type AnalyticsProperties,
} from "@/lib/analytics-properties";

type CaptureServerEventInput = {
  distinctId?: string | null;
  event: string;
  properties?: AnalyticsProperties;
};

export async function captureServerEvent({
  distinctId,
  event,
  properties = {},
}: CaptureServerEventInput) {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;

  const client = new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });

  try {
    client.capture({
      distinctId: distinctId || "anonymous",
      event,
      properties: compactAnalyticsProperties(properties),
    });
    await client.shutdown();
  } catch {
    try {
      await client.shutdown();
    } catch {}
  }
}
