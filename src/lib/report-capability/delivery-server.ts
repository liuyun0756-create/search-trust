import "server-only";
import { getCurrentUser } from "../auth";
import { createServerClient } from "../supabase";
import { isLocalE2ETestMode } from "../e2e-v22/config";
import { CapabilityRepository } from "./repository";
import { CapabilityShareService } from "./shares";
import { capabilityPdfResponse } from "./pdf";
import { createCapabilityDeliveryHandlers } from "./delivery-handler";
export const capabilityDeliveryHandlers=createCapabilityDeliveryHandlers({getCurrentUser,
  isEnabled:()=>process.env.V22_CAPABILITY_DISPATCH_ENABLED==="true"&&!isLocalE2ETestMode(),
  reports:()=>new CapabilityRepository(createServerClient()),shares:()=>new CapabilityShareService(createServerClient()),pdf:capabilityPdfResponse});
