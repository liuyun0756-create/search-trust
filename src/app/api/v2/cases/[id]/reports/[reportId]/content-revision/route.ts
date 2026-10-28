import { getCurrentUser } from "@/lib/auth";
import { isLocalE2ETestMode } from "@/lib/e2e-v22/config";
import { CapabilityRepository } from "@/lib/report-capability/repository";
import { createCapabilityRevisionHandlers } from "@/lib/report-capability/revision-handler";
import { createServerClient } from "@/lib/supabase";

export const {GET,PUT,POST} = createCapabilityRevisionHandlers({
  getCurrentUser,
  isEnabled: () => process.env.V22_CAPABILITY_DISPATCH_ENABLED === "true" && !isLocalE2ETestMode(),
  repository: () => new CapabilityRepository(createServerClient()),
});
