import { NextRequest, NextResponse } from "next/server";
import { isUuid, parseProspectWorkflowRecovery, type ProspectWorkflowRecovery } from "./contracts";

interface Dependencies {
  getCurrentUser(): Promise<{ userId: string } | null>;
  findWorkflow(userId: string, workflowId: string): Promise<ProspectWorkflowRecovery | null>;
}

export function createProspectRecoveryHandler(dependencies: Dependencies) {
  return async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const headers = { "cache-control": "no-store" };
    const error = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status, headers });
    const user = await dependencies.getCurrentUser();
    if (!user) return error("UNAUTHORIZED", "Sign in to resume this analysis.", 401);
    const id = (await context.params).id;
    if (!isUuid(id)) return error("INVALID_REQUEST", "The workflow ID is invalid.", 400);
    try {
      const value = await dependencies.findWorkflow(user.userId, id);
      if (!value) return error("PROSPECT_WORKFLOW_NOT_FOUND", "This workflow was not found for your account. Return to Cases & reports before starting another analysis.", 404);
      const parsed = parseProspectWorkflowRecovery(value);
      if (!parsed || parsed.workflow_id !== id) throw new Error("INVALID_RECOVERY");
      return NextResponse.json(parsed, { headers });
    } catch {
      return error("PROSPECT_WORKFLOW_UNAVAILABLE", "The saved workflow could not be checked. Refresh to reconnect; no new analysis has been started.", 503);
    }
  };
}
