import { getCurrentUser } from "@/lib/auth";
import { createServerCaseService } from "@/lib/cases";
import { DodoClient } from "@/lib/payments-v22";
import { createServerClient } from "@/lib/supabase";
import { createVerifiedCreditConfirmHandler, SupabaseVerifiedCreditRepository } from "@/lib/verified-credits-v22";

const handler = createVerifiedCreditConfirmHandler({
  getCurrentUser,
  createCaseService: createServerCaseService,
  createRepository: () => new SupabaseVerifiedCreditRepository(createServerClient()),
  createDodoClient: () => new DodoClient(process.env.DODO_BASE_URL || "", process.env.DODO_API_KEY || ""),
  isCheckoutEnabled: () => process.env.GOOGLE_VERIFIED_ANALYSIS_ENABLED === "true",
  isDodoConfigured: () => Boolean(process.env.DODO_API_KEY && process.env.DODO_BASE_URL),
  getProductId: () => process.env.DODO_VERIFIED_CREDIT_PRODUCT_ID || "",
  getBaseUrl: () => process.env.NEXT_PUBLIC_BASE_URL || "",
});

export const dynamic = "force-dynamic";
export const POST = handler.POST;
