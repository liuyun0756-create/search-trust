import { getCurrentUser } from "@/lib/auth";
import { SupabaseProspectWorkflowRepository } from "@/lib/prospect-workflow-v22";
import { createProspectRecoveryHandler } from "@/lib/prospect-workflow-v22/recovery";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
// Read-only recovery stays available when new public analysis entry is paused.
export const GET = createProspectRecoveryHandler({
  getCurrentUser,
  findWorkflow: (userId, workflowId) => new SupabaseProspectWorkflowRepository(createServerClient()).recover(userId, workflowId),
});
