import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { GenerateReportResponse } from "@/types/database";

const MOCK_REPORT: GenerateReportResponse = {
  report_id: `RPT-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-001`,
  url: "",
  page_type: "",
  gbp_url: null,
  created_at: new Date().toISOString(),
  trust_status: "Medium",
  trust_status_desc:
    "The page has foundational local relevance, but trust signals are not yet strong enough for stable performance.",
  ranking_potential: "Moderate",
  ranking_potential_desc:
    "This page can compete in local search, but still has visible gaps versus stronger local landing pages.",
  risk_level: "Medium-High",
  risk_level_desc:
    "Rankings may be unstable if stronger competitors provide clearer local trust and business proof.",
  stage_1_html: `
    <div class="space-y-8">
      <div>
        <h2 class="text-2xl font-bold tracking-tighter mb-4">Executive Summary</h2>
        <div class="p-8 bg-blue-50/50 rounded-3xl border border-blue-100">
          <p class="text-lg font-medium leading-relaxed text-gray-800">
            "Google can understand what you offer, but cannot consistently confirm who you are.
            As a result, trust signals cannot accumulate properly."
          </p>
        </div>
      </div>
      <div class="grid md:grid-cols-2 gap-8">
        <div class="space-y-4">
          <h4 class="text-sm font-black uppercase text-gray-400 tracking-widest">Current Assessment</h4>
          <p class="text-base font-medium leading-relaxed">
            Your page sits above the basic participation threshold, but below the level typically associated with strong, trust-rich local landing pages.
          </p>
        </div>
        <div class="space-y-4">
          <h4 class="text-sm font-black uppercase text-gray-400 tracking-widest">Impact Pattern</h4>
          <ul class="space-y-2">
            <li class="flex items-center gap-3 text-sm font-bold">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Brand binding is weak
            </li>
            <li class="flex items-center gap-3 text-sm font-bold">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Local signal efficiency is low
            </li>
            <li class="flex items-center gap-3 text-sm font-bold">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Rankings lack stability
            </li>
          </ul>
        </div>
      </div>
    </div>
  `,
  stage_2_html: `
    <div class="space-y-12">
      <div class="grid md:grid-cols-2 gap-6">
        <div class="p-6 rounded-3xl bg-gray-50 border border-white">
          <h4 class="font-bold mb-2">Observed Strength</h4>
          <p class="text-sm text-gray-500 leading-relaxed font-medium">
            The page already aligns with a service intent and includes some degree of local relevance, giving it a chance to enter local search competition.
          </p>
        </div>
        <div class="p-6 rounded-3xl bg-gray-50 border border-white">
          <h4 class="font-bold mb-2">Main Limitation</h4>
          <p class="text-sm text-gray-500 leading-relaxed font-medium">
            The page still depends too much on general domain strength and does not yet establish itself as a strong independent local asset.
          </p>
        </div>
        <div class="p-6 rounded-3xl bg-gray-50 border border-white">
          <h4 class="font-bold mb-2">Likely Search Outcome</h4>
          <p class="text-sm text-gray-500 leading-relaxed font-medium">
            May appear in mid-range local results, but rankings will fluctuate depending on query specificity and competitor updates.
          </p>
        </div>
        <div class="p-6 rounded-3xl bg-gray-50 border border-white">
          <h4 class="font-bold mb-2">Competitive Interpretation</h4>
          <p class="text-sm text-gray-500 leading-relaxed font-medium">
            Outperforms thin or templated pages, but falls short of pages with strong local proof and entity consistency.
          </p>
        </div>
      </div>
    </div>
  `,
  stage_3_html: `
    <div class="space-y-8">
      <h2 class="text-2xl font-bold tracking-tighter mb-6">Key Issues Detected</h2>
      <div class="space-y-4">
        <div class="p-6 rounded-2xl bg-red-50 border border-red-100">
          <h4 class="font-bold text-red-700 mb-2">1. Weak Entity Binding</h4>
          <p class="text-sm text-gray-600 leading-relaxed">Google cannot consistently connect your brand to a verified business entity.</p>
        </div>
        <div class="p-6 rounded-2xl bg-orange-50 border border-orange-100">
          <h4 class="font-bold text-orange-700 mb-2">2. Shallow Trust Accumulation</h4>
          <p class="text-sm text-gray-600 leading-relaxed">Local signals are present but fragmented, preventing trust from building over time.</p>
        </div>
        <div class="p-6 rounded-2xl bg-yellow-50 border border-yellow-100">
          <h4 class="font-bold text-yellow-700 mb-2">3. Limited Proof Depth</h4>
          <p class="text-sm text-gray-600 leading-relaxed">The page lacks sufficient proof of service accountability and real-world operation.</p>
        </div>
      </div>
    </div>
  `,
  stage_4_html: `
    <div class="space-y-8">
      <h2 class="text-2xl font-bold tracking-tighter mb-6">Six-Layer Model Diagnosis</h2>
      <div class="grid md:grid-cols-2 gap-6">
        <div class="p-6 rounded-2xl border border-green-200 bg-green-50">
          <h4 class="font-bold text-green-700 mb-2">L1 — Content Relevance</h4>
          <p class="text-sm text-gray-600">Page content aligns with search intent adequately.</p>
        </div>
        <div class="p-6 rounded-2xl border border-blue-200 bg-blue-50">
          <h4 class="font-bold text-blue-700 mb-2">L2 — Structural Signals</h4>
          <p class="text-sm text-gray-600">HTML structure supports crawlability but lacks semantic depth.</p>
        </div>
        <div class="p-6 rounded-2xl border border-orange-200 bg-orange-50">
          <h4 class="font-bold text-orange-700 mb-2">L3 — Entity Consistency</h4>
          <p class="text-sm text-gray-600">Brand and location entities are inconsistent across signals.</p>
        </div>
        <div class="p-6 rounded-2xl border border-red-200 bg-red-50">
          <h4 class="font-bold text-red-700 mb-2">L4 — Trust Accumulation</h4>
          <p class="text-sm text-gray-600">Signals are too fragmented for sustained trust to build.</p>
        </div>
        <div class="p-6 rounded-2xl border border-purple-200 bg-purple-50">
          <h4 class="font-bold text-purple-700 mb-2">L5 — Local Authority</h4>
          <p class="text-sm text-gray-600">Local authority signals are present but below competitive threshold.</p>
        </div>
        <div class="p-6 rounded-2xl border border-gray-200 bg-gray-50">
          <h4 class="font-bold text-gray-700 mb-2">L6 — Competitive Position</h4>
          <p class="text-sm text-gray-600">Page can compete in mid-range but not yet in top-tier local results.</p>
        </div>
      </div>
    </div>
  `,
  stage_5_html: `
    <div class="space-y-10">
      <h2 class="text-2xl font-bold tracking-tighter mb-6">Optimization Path</h2>
      <div class="space-y-6">
        <div class="p-8 rounded-3xl bg-gray-50 border border-gray-100">
          <h4 class="font-bold mb-3">Priority 1 — Strengthen Entity Binding</h4>
          <p class="text-sm text-gray-600 leading-relaxed">Ensure NAP consistency, add structured data markup (LocalBusiness schema), and verify Google Business Profile.</p>
        </div>
        <div class="p-8 rounded-3xl bg-gray-50 border border-gray-100">
          <h4 class="font-bold mb-3">Priority 2 — Build Trust Signals</h4>
          <p class="text-sm text-gray-600 leading-relaxed">Add customer reviews, case studies, service guarantees, and verifiable business credentials to the page.</p>
        </div>
        <div class="p-8 rounded-3xl bg-gray-50 border border-gray-100">
          <h4 class="font-bold mb-3">Priority 3 — Improve Local Depth</h4>
          <p class="text-sm text-gray-600 leading-relaxed">Expand location-specific content, add local testimonials, community involvement, and area-specific service details.</p>
        </div>
      </div>
    </div>
  `,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, page_type, gbp_url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // TODO: 后端 API ready 后，替换为真实调用
    // const response = await fetch(process.env.REPORT_API_URL!, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${process.env.REPORT_API_KEY}`,
    //   },
    //   body: JSON.stringify({ url, page_type, gbp_url }),
    // });
    // const data = await response.json();

    // Mock: 填入用户提交的参数
    const report: GenerateReportResponse = {
      ...MOCK_REPORT,
      url,
      page_type,
      gbp_url: gbp_url || null,
      report_id: `RPT-${Date.now().toString(36).toUpperCase()}`,
      created_at: new Date().toISOString(),
    };

    // 存入 Supabase
    const supabase = createServerClient();
    const { error } = await supabase.from("reports").insert({
      report_id: report.report_id,
      user_id: "00000000-0000-0000-0000-000000000000", // TODO: 从 Clerk session获取
      url: report.url,
      page_type: report.page_type,
      gbp_url: report.gbp_url,
      status: "free_preview",
      trust_status: report.trust_status,
      trust_status_desc: report.trust_status_desc,
      ranking_potential: report.ranking_potential,
      ranking_potential_desc: report.ranking_potential_desc,
      risk_level: report.risk_level,
      risk_level_desc: report.risk_level_desc,
      stage_1_html: report.stage_1_html,
      stage_2_html: report.stage_2_html,
      stage_3_html: report.stage_3_html,
      stage_4_html: report.stage_4_html,
      stage_5_html: report.stage_5_html,
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Generate report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
