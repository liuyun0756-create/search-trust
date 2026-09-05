import { getCurrentUser } from "@/lib/auth";
import { createServerResourceService } from "@/lib/google-resources";
import { createResourceHandlers } from "@/lib/google-resources/handlers";

export const runtime = "nodejs";
export const maxDuration = 60;
const handlers = createResourceHandlers({ getCurrentUser, createService: createServerResourceService });
export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
