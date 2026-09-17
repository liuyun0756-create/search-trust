import { getCurrentUser } from "@/lib/auth";
import { createCreditPaymentConfirmHandler, SupabaseCreditPaymentRepository } from "@/lib/credit-payments-v22";
import { DodoClient } from "@/lib/payments-v22";
import { createServerClient } from "@/lib/supabase";

const handler = createCreditPaymentConfirmHandler({
  getCurrentUser,
  createRepository: () => new SupabaseCreditPaymentRepository(createServerClient()),
  createDodoClient: () => new DodoClient(process.env.DODO_BASE_URL || "", process.env.DODO_API_KEY || ""),
  isDodoConfigured: () => Boolean(process.env.DODO_API_KEY?.trim() && process.env.DODO_BASE_URL?.trim()),
  getProductId: () => process.env.DODO_CREDIT_PRODUCT_ID?.trim() || "",
  getBaseUrl: () => process.env.NEXT_PUBLIC_BASE_URL || "",
});

export const dynamic = "force-dynamic";
export const POST = handler.POST;
