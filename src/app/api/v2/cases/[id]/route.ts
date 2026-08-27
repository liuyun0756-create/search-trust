import { getCurrentUser } from "@/lib/auth";
import { createServerCaseService } from "@/lib/cases";
import { createCaseItemHandlers } from "@/lib/cases/handlers";

const handlers = createCaseItemHandlers({
  getCurrentUser,
  createService: createServerCaseService,
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
