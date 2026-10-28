import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { loadOwnedCapabilityDispatch } from "@/lib/report-capability/dispatch";
import { createCapabilityDispatchHandler } from "@/lib/report-capability/dispatch-handler";

export const POST = createCapabilityDispatchHandler({
  getCurrentUser,
  isEnabled: () => process.env.V22_CAPABILITY_DISPATCH_ENABLED === "true",
  loadDispatch: (user, caseId, job, key) => loadOwnedCapabilityDispatch(createServerClient(), user, caseId, job, key),
  getConfig: () => {
    const baseUrl = process.env.V22_API_BASE_URL, token = process.env.V22_INTERNAL_API_TOKEN;
    return baseUrl && token ? { baseUrl, token } : null;
  },
  fetcher: fetch,
  timeoutMs: 30_000,
});
