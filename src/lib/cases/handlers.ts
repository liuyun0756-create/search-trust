import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { CaseApiError, caseErrorBody } from "./errors";
import {
  parseCaseId,
  parseCaseListQuery,
  parseCreateCaseInput,
  parseUpdateCaseInput,
} from "./normalize";
import type { CaseService } from "./service";

type CurrentUser = { userId: string } | null;

export interface CaseHandlerDependencies {
  getCurrentUser: () => Promise<CurrentUser>;
  createService: () => CaseService;
}

async function authenticatedUserId(dependencies: CaseHandlerDependencies): Promise<string> {
  const user = await dependencies.getCurrentUser();
  if (!user) throw CaseApiError.unauthorized();
  return user.userId;
}

function errorResponse(error: unknown, route: string, requestId: string): NextResponse {
  const apiError = error instanceof CaseApiError ? error : CaseApiError.internal();
  if (apiError.status >= 500) {
    console.error("Case API request failed", {
      route,
      request_id: requestId,
      code: apiError.code,
      error_type: error instanceof Error ? error.name : "UnknownError",
    });
  }
  return NextResponse.json(caseErrorBody(apiError), {
    status: apiError.status,
    headers: { "x-request-id": requestId },
  });
}

async function requestJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw CaseApiError.invalid([{ path: "/", message: "must contain valid JSON" }]);
  }
}

export function createCaseCollectionHandlers(
  dependencies: CaseHandlerDependencies,
) {
  return {
    async GET(request: NextRequest) {
      const requestId = randomUUID();
      try {
        const userId = await authenticatedUserId(dependencies);
        const query = parseCaseListQuery(request.nextUrl.searchParams);
        const page = await dependencies.createService().list(userId, query);
        return NextResponse.json(page, { headers: { "x-request-id": requestId } });
      } catch (error) {
        return errorResponse(error, "GET /api/v2/cases", requestId);
      }
    },

    async POST(request: NextRequest) {
      const requestId = randomUUID();
      try {
        const userId = await authenticatedUserId(dependencies);
        const input = parseCreateCaseInput(await requestJson(request));
        const created = await dependencies.createService().create(userId, input);
        return NextResponse.json(created, {
          status: 201,
          headers: { "x-request-id": requestId },
        });
      } catch (error) {
        return errorResponse(error, "POST /api/v2/cases", requestId);
      }
    },
  };
}

export function createCaseItemHandlers(
  dependencies: CaseHandlerDependencies,
) {
  type Context = { params: Promise<{ id: string }> };

  return {
    async GET(_request: NextRequest, context: Context) {
      const requestId = randomUUID();
      try {
        const userId = await authenticatedUserId(dependencies);
        const caseId = parseCaseId((await context.params).id);
        const resource = await dependencies.createService().get(userId, caseId);
        return NextResponse.json(resource, { headers: { "x-request-id": requestId } });
      } catch (error) {
        return errorResponse(error, "GET /api/v2/cases/:id", requestId);
      }
    },

    async PATCH(request: NextRequest, context: Context) {
      const requestId = randomUUID();
      try {
        const userId = await authenticatedUserId(dependencies);
        const caseId = parseCaseId((await context.params).id);
        const input = parseUpdateCaseInput(await requestJson(request));
        const resource = await dependencies.createService().update(userId, caseId, input);
        return NextResponse.json(resource, { headers: { "x-request-id": requestId } });
      } catch (error) {
        return errorResponse(error, "PATCH /api/v2/cases/:id", requestId);
      }
    },

    async DELETE(_request: NextRequest, context: Context) {
      const requestId = randomUUID();
      try {
        const userId = await authenticatedUserId(dependencies);
        const caseId = parseCaseId((await context.params).id);
        const resource = await dependencies.createService().archive(userId, caseId);
        return NextResponse.json(resource, { headers: { "x-request-id": requestId } });
      } catch (error) {
        return errorResponse(error, "DELETE /api/v2/cases/:id", requestId);
      }
    },
  };
}
