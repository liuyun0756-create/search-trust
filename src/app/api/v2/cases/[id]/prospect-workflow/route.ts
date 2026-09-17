import { getCurrentUser } from "@/lib/auth";
import { createDiscoverySubmitProxy } from "@/lib/preflight-v22/proxy";
import { createProspectWorkflowHandlers, SupabaseProspectWorkflowRepository } from "@/lib/prospect-workflow-v22";
import { createServerClient } from "@/lib/supabase";

const handlers = createProspectWorkflowHandlers({
  getCurrentUser,
  createRepository: () => new SupabaseProspectWorkflowRepository(createServerClient()),
  submitDiscovery: createDiscoverySubmitProxy(),
  getDiscovery: async () => new Response(null, { status: 405 }),
  retryDiscovery: async () => new Response(null, { status: 405 }),
});

export const dynamic = "force-dynamic";
export const POST = handlers.POST;
