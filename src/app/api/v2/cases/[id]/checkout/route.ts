import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { createServerCaseService } from "@/lib/cases";
import {
  createCasePaymentHandlers,
  DodoClient,
  SupabaseCasePaymentRepository,
} from "@/lib/payments-v22";

const handlers = createCasePaymentHandlers({
  getCurrentUser,
  createCaseService: createServerCaseService,
  createRepository: () => new SupabaseCasePaymentRepository(createServerClient()),
  createDodoClient: () => new DodoClient(
    process.env.DODO_BASE_URL || "https://test.dodopayments.com",
    process.env.DODO_API_KEY || "",
  ),
  getProductId: () => process.env.DODO_API_KEY
    ? process.env.DODO_PROSPECT_REPORT_PRODUCT_ID || ""
    : "",
  getBaseUrl: () => process.env.NEXT_PUBLIC_BASE_URL || "",
});

export const GET = handlers.GET;
export const POST = handlers.POST;
