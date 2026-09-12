import { getCurrentUser } from "@/lib/auth";
import { createServerCaseService } from "@/lib/cases";
import { createCaseCollectionHandlers } from "@/lib/cases/handlers";
import { requireV22PublicEntry } from "@/lib/release-v22/public-entry";

const handlers = createCaseCollectionHandlers({
  getCurrentUser,
  createService: createServerCaseService,
});

export const GET = handlers.GET;
export const POST = requireV22PublicEntry(handlers.POST);
