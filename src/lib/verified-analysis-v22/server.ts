import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { createVerifiedAnalysisSubmitHandler } from "./handlers";
import { SupabaseVerifiedAnalysisRepository } from "./repository";

function config() {
  const baseUrl = process.env.V22_API_BASE_URL?.trim();
  const token = process.env.V22_INTERNAL_API_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  try {
    const url = new URL(baseUrl);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    return { baseUrl: url.toString().replace(/\/$/, ""), token };
  } catch { return null; }
}

export const submitVerifiedAnalysis = createVerifiedAnalysisSubmitHandler({
  getCurrentUser,
  isEnabled: () => process.env.GOOGLE_VERIFIED_ANALYSIS_ENABLED === "true",
  createRepository: () => new SupabaseVerifiedAnalysisRepository(createServerClient()),
  getConfig: config,
  fetcher: fetch,
  timeoutMs: 30_000,
});
