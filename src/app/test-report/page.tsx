"use client";

import { useState } from "react";
import { BackHeader } from "@/components/common/BackHeader";

const BACKEND_URL = "https://searchtrust-rd-production.up.railway.app/api/v1";

export default function TestReportPage() {
  const [url, setUrl] = useState("");
  const [pageType, setPageType] = useState("Service Page");
  const [gbpUrl, setGbpUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [progress, setProgress] = useState("");
  const [reportData, setReportData] = useState<any>(null);
  const [error, setError] = useState("");
  const [rawJson, setRawJson] = useState("");

  const pageTypeMap: Record<string, string> = {
    "Service Page": "本地服务落地页",
    "Location Page": "Location Page",
    "Landing Page": "Landing Page",
    "City Page": "City Page",
    "Service-Area Page": "Service-Area Page",
    "Product Page": "Product Page",
    "Blog Post": "Blog Post",
  };

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setReportData(null);
    setRawJson("");
    setProgress("Step 1: Creating task...");

    try {
      // 1. 创建任务
      const res = await fetch(`${BACKEND_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          page_type: pageTypeMap[pageType] || pageType,
          language: "English",
          ...(gbpUrl.trim() ? { gbp_url: gbpUrl.trim() } : {}),
        }),
      });

      if (!res.ok) {
        throw new Error(`Create task failed: ${res.status} ${await res.text()}`);
      }

      const { task_id } = await res.json();
      setProgress(`Step 2: Task created (task_id: ${task_id}), polling every 3s...`);

      // 2. 轮询
      setLoading(false);
      setPolling(true);
      let attempts = 0;
      const maxAttempts = 120; // 最多轮询 6 分钟

      const poll = async (): Promise<void> => {
        attempts++;
        const taskRes = await fetch(`${BACKEND_URL}/task/${task_id}`);
        const taskData = await taskRes.json();

        if (taskData.status === "done") {
          setPolling(false);
          setProgress(`Done! (${attempts} polls, ~${attempts * 3}s)`);

          // 解析 result.score，兼容纯 JSON 字符串、旧 code fence 字符串、对象。
          const score = taskData.result?.score;
          const parsed = typeof score === "string"
            ? JSON.parse(score.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""))
            : score;

          setReportData(parsed);
          setRawJson(JSON.stringify(parsed, null, 2));
          return;
        }

        if (taskData.status === "failed" || taskData.error) {
          setPolling(false);
          setError(`Task failed: ${taskData.error || "Unknown error"}`);
          return;
        }

        setProgress(
          `Polling... attempt #${attempts}, status: ${taskData.status}, progress: ${taskData.progress?.percent || 0}% — ${taskData.progress?.message || ""}`
        );

        if (attempts >= maxAttempts) {
          setPolling(false);
          setError("Polling timeout (6 min)");
          return;
        }

        // 3 秒后继续轮询
        await new Promise((r) => setTimeout(r, 3000));
        await poll();
      };

      await poll();
    } catch (err: any) {
      setLoading(false);
      setPolling(false);
      setError(err.message || "Unknown error");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <BackHeader />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-[#1A1F2B] mb-8">
          Test Report Generation
        </h1>

        {/* 表单 */}
        <div className="bg-[#F8F9FA] rounded-2xl p-8 mb-8 space-y-4">
          <div>
            <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">
              URL <span className="text-[#A5D020]">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://nxtlvlautospa.com/"
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#A5D020]/20"
            />
          </div>

          <div>
            <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">
              GBP URL (optional)
            </label>
            <input
              type="url"
              value={gbpUrl}
              onChange={(e) => setGbpUrl(e.target.value)}
              placeholder="https://www.google.com/maps/search/..."
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#A5D020]/20"
            />
          </div>

          <div>
            <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">
              Page Type
            </label>
            <select
              aria-label="Page Type"
              value={pageType}
              onChange={(e) => setPageType(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#A5D020]/20"
            >
              {Object.keys(pageTypeMap).map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || polling || !url.trim()}
            className="w-full bg-[#1D2531] text-white font-bold text-[15px] rounded-full px-6 py-4 hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Creating task..." : polling ? "Polling..." : "Run Test"}
          </button>
        </div>

        {/* 状态 */}
        {progress && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
            <p className="text-[14px] text-blue-700 font-medium">{progress}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
            <p className="text-[14px] text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* 结果展示 - 5 个模块 */}
        {reportData && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#1A1F2B]">Report Result</h2>

            {[
              { key: "module_1_overview", label: "Module 1: Overview" },
              { key: "module_2_page_level", label: "Module 2: Page Level" },
              { key: "module_3_key_problems", label: "Module 3: Key Problems" },
              { key: "module_4_eight_layers", label: "Module 4: Eight Layers" },
              { key: "module_5_optimization", label: "Module 5: Optimization" },
            ].map(({ key, label }) => (
              <div key={key} className="bg-[#F8F9FA] rounded-2xl p-6">
                <h3 className="text-[16px] font-bold text-[#1A1F2B] mb-3">{label}</h3>
                <pre className="text-[12px] text-gray-600 whitespace-pre-wrap overflow-auto max-h-[400px] bg-white rounded-xl p-4 border border-gray-100">
                  {JSON.stringify(reportData[key], null, 2)}
                </pre>
              </div>
            ))}

            {/* 原始 JSON */}
            <details className="bg-[#F8F9FA] rounded-2xl p-6">
              <summary className="text-[16px] font-bold text-[#1A1F2B] cursor-pointer">
                Raw JSON (click to expand)
              </summary>
              <pre className="mt-4 text-[11px] text-gray-600 whitespace-pre-wrap overflow-auto max-h-[600px] bg-white rounded-xl p-4 border border-gray-100">
                {rawJson}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
