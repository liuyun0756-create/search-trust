import {checkedKeywordQueries} from '../target-keywords/contracts';
import { NextRequest, NextResponse } from "next/server";

import { parseDiscoveryRequest } from "@/lib/preflight-v22/validate";
import type { ProspectWorkflowRepository } from "./repository";
import { ProspectWorkflowPersistenceError } from "./repository";
import { isUuid } from "./contracts";

const IDEMPOTENCY = /^[A-Za-z0-9._:-]{8,200}$/;

interface Dependencies {
  keywordsEnabled?():boolean;
  getCurrentUser(): Promise<{ userId: string } | null>;
  createRepository(): ProspectWorkflowRepository;
  submitDiscovery(request: NextRequest): Promise<Response>;
  getDiscovery(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response>;
  retryDiscovery(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response>;
}

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

export function createProspectWorkflowHandlers(dependencies: Dependencies) {
  type CaseContext = { params: Promise<{ id: string }> };
  type DiscoveryContext = { params: Promise<{ id: string }> };

  return {
    async POST(request: NextRequest, context: CaseContext) {
      const user = await dependencies.getCurrentUser();
      if (!user) return error("UNAUTHORIZED", "Sign in to start prospect discovery.", 401);
      const caseId = (await context.params).id;
      const workflowId = request.headers.get("x-searchtrust-workflow-id") ?? "";
      const discoveryJobId = request.headers.get("x-searchtrust-discovery-job-id") ?? "";
      const idempotencyKey = request.headers.get("x-searchtrust-workflow-idempotency-key") ?? "";
      const taskIdempotencyKey = request.headers.get("idempotency-key") ?? "";
      if (!isUuid(caseId) || !isUuid(workflowId) || !isUuid(discoveryJobId) || !IDEMPOTENCY.test(idempotencyKey) || !IDEMPOTENCY.test(taskIdempotencyKey)) {
        return error("INVALID_REQUEST", "The Prospect workflow identifiers are invalid.", 400);
      }
      let body: unknown;
      try { body = await request.clone().json(); } catch {
        return error("INVALID_REQUEST", "The competitor discovery request is invalid.", 400);
      }
      const parsed = parseDiscoveryRequest(body);
      if (!parsed.ok || parsed.value.case_id !== caseId) {
        return error("INVALID_REQUEST", "The discovery request does not match this Case.", 400);
      }
      const keywordRevision=request.headers.get("x-searchtrust-keyword-planning-revision");
      let repo:ProspectWorkflowRepository;
      let keywordsOn=dependencies.keywordsEnabled?.()===true;
      try{
        repo=dependencies.createRepository();
        if(keywordsOn&&keywordRevision===null&&await repo.canResumeLegacy?.(user.userId,caseId,workflowId))keywordsOn=false;
      }catch{return error("PROSPECT_WORKFLOW_UNAVAILABLE","The saved workflow could not be checked. Reload before continuing; no credit has been reserved.",503);}

      if((keywordsOn&&(keywordRevision===null||!/^[1-9][0-9]{0,9}$/.test(keywordRevision)||Number(keywordRevision)>2147483647
         ||!checkedKeywordQueries(parsed.value.queries)||parsed.value.queries.some(q=>q!==q.trim())))||(!keywordsOn&&keywordRevision!==null))
        return error("TARGET_KEYWORDS_REQUIRED","Confirm and save 3–5 target keywords before starting. No credit has been reserved.",409);
      let reservation;
      try {
        reservation = await repo.reserve({
          userId: user.userId,
          caseId,
          workflowId,
          discoveryJobId,
          idempotencyKey,
          taskIdempotencyKey,
          ...(keywordsOn?{keywords:{queries:parsed.value.queries,planningRevision:Number(keywordRevision),scope:{primary_service:parsed.value.primary_service,target_market:parsed.value.target_market}}}:{}),
        });
      } catch (cause) {
        if (cause instanceof ProspectWorkflowPersistenceError && cause.code === "INSUFFICIENT_CREDITS") {
          return error("INSUFFICIENT_CREDITS", "Buy 1 credit to start this Prospect analysis.", 409);
        }
        if(cause instanceof ProspectWorkflowPersistenceError&&["PLANNING_SETTINGS_CONFLICT","TARGET_KEYWORDS_DISCOVERY_CONFLICT"].includes(cause.code))
          return error(cause.code,"Saved target keywords changed. Reload and confirm the list before starting. No credit has been reserved.",409);
        return error("PROSPECT_WORKFLOW_UNAVAILABLE", "The Prospect workflow could not be reserved yet.", 409);
      }
      if (reservation.charge_state === "compensated") {
        return error("PROSPECT_WORKFLOW_COMPENSATED", "This attempt was closed and its credit was returned. Start a new analysis to continue.", 409);
      }
      const response = await dependencies.submitDiscovery(request);
      response.headers.set("x-searchtrust-workflow-id", reservation.workflow_id);
      response.headers.set("x-searchtrust-credit-balance", String(reservation.credit_balance));
      response.headers.set("cache-control", "no-store");
      return response;
    },

    async GET(request: NextRequest, context: DiscoveryContext) {
      const user = await dependencies.getCurrentUser();
      if (!user) return error("UNAUTHORIZED", "Sign in to view prospect discovery.", 401);
      const discoveryJobId = (await context.params).id;
      if (!isUuid(discoveryJobId)) return error("INVALID_REQUEST", "The discovery task ID is invalid.", 400);
      try {
        if (!await dependencies.createRepository().ownsDiscovery(user.userId, discoveryJobId)) {
          return error("DISCOVERY_JOB_NOT_FOUND", "The competitor discovery task was not found.", 404);
        }
      } catch {
        return error("PROSPECT_WORKFLOW_UNAVAILABLE", "The Prospect workflow could not be checked yet.", 503);
      }
      return dependencies.getDiscovery(request, context);
    },

    async RETRY(request: NextRequest, context: DiscoveryContext) {
      const user = await dependencies.getCurrentUser();
      if (!user) return error("UNAUTHORIZED", "Sign in to retry prospect discovery.", 401);
      const discoveryJobId = (await context.params).id;
      if (!isUuid(discoveryJobId)) return error("INVALID_REQUEST", "The discovery task ID is invalid.", 400);
      try {
        if (!await dependencies.createRepository().ownsDiscovery(user.userId, discoveryJobId)) {
          return error("DISCOVERY_JOB_NOT_FOUND", "The competitor discovery task was not found.", 404);
        }
      } catch {
        return error("PROSPECT_WORKFLOW_UNAVAILABLE", "The Prospect workflow could not be checked yet.", 503);
      }
      return dependencies.retryDiscovery(request, context);
    },
  };
}
