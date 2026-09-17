import { getCurrentUser } from "@/lib/auth";
import { createCreditAccountHandler, SupabaseCreditRepository } from "@/lib/credits-v22";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const GET = createCreditAccountHandler({
  getCurrentUser,
  createRepository: () => new SupabaseCreditRepository(createServerClient()),
});
