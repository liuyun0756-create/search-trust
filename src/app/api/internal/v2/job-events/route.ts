import { createServerJobEventHandler } from "@/lib/jobs-v22/handlers";

const handlers = createServerJobEventHandler();

export const POST = handlers.POST;

