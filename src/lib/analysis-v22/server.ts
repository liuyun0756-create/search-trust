import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { createAnalysisStatusHandler, createAnalysisStreamHandler, createAnalysisSubmitHandler, createLatestAnalysisHandler } from "./handlers";
import { SupabaseAnalysisRepository } from "./repository";

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

const dependencies = {
  getCurrentUser,
  createRepository: () => new SupabaseAnalysisRepository(createServerClient()),
  getConfig: config,
  fetcher: fetch,
  timeoutMs: 30_000,
};

export const submitAnalysis = createAnalysisSubmitHandler(dependencies);
export const getAnalysisStatus = createAnalysisStatusHandler(dependencies);
export const getLatestAnalysis = createLatestAnalysisHandler(dependencies);
export const streamAnalysis = createAnalysisStreamHandler(dependencies);
