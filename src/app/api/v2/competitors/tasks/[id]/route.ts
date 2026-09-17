import { getCurrentUser } from "@/lib/auth";
import { createDiscoveryRetryProxy, createDiscoveryStatusProxy } from "@/lib/preflight-v22/proxy";
import { createProspectWorkflowHandlers, SupabaseProspectWorkflowRepository } from "@/lib/prospect-workflow-v22";
import { createServerClient } from "@/lib/supabase";

const handlers = createProspectWorkflowHandlers({
  getCurrentUser,
  createRepository: () => new SupabaseProspectWorkflowRepository(createServerClient()),
  submitDiscovery: async () => new Response(null, { status: 405 }),
  getDiscovery: createDiscoveryStatusProxy(),
  retryDiscovery: createDiscoveryRetryProxy(),
});

export const dynamic = "force-dynamic";
export const GET = handlers.GET;
