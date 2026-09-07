import { getCurrentUser } from "@/lib/auth";
import { createServerConnectionCenterService } from "@/lib/connection-center";
import { createConnectionCenterHandlers } from "@/lib/connection-center/handlers";

export const runtime = "nodejs";
export const maxDuration = 30;

const handlers = createConnectionCenterHandlers({
  enabled: () => process.env.GOOGLE_CONNECTIONS_ENABLED === "true",
  getCurrentUser,
  createService: createServerConnectionCenterService,
});

export const GET = handlers.GET;
