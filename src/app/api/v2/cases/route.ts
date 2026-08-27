import { getCurrentUser } from "@/lib/auth";
import { createServerCaseService } from "@/lib/cases";
import { createCaseCollectionHandlers } from "@/lib/cases/handlers";

const handlers = createCaseCollectionHandlers({
  getCurrentUser,
  createService: createServerCaseService,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
