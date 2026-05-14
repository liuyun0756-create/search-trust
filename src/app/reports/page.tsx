"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { FileSearch } from "lucide-react";
import { ReportContent } from "@/components/report/ReportContent";
import { ReportHistory } from "@/components/report/ReportHistory";
import { RunAuditButton } from "@/components/common/RunAuditButton";
import { BackHeader } from "@/components/common/BackHeader";
import type { Report } from "@/types/database";

const MOCK_HISTORY = [
  {
    date: "July 12, 2025",
    items: [
      { id: "mock-001", url: "example.com/local-plumbing", reportId: "RPT-240712-018" },
      { id: "mock-002", url: "simpleanalytics.com/pricing", reportId: "RPT-240712-017" },
    ],
  },
  {
    date: "July 10, 2025",
    items: [
      { id: "mock-003", url: "ahrefs.com/seo-audit", reportId: "RPT-240710-001" },
    ],
  },
];

// TODO: 对接真实 API 后设为 false，用 MOCK_HISTORY 调试时设为 true
const USE_MOCK = true;

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 bg-white rounded-[28px] border border-gray-100 shadow-sm flex items-center justify-center mx-auto mb-8">
          <FileSearch className="w-9 h-9 text-[#A5D020]" />
        </div>
        <h2 className="text-[28px] font-bold tracking-tighter text-[#1A212B] mb-3">
          No reports yet
        </h2>
        <p className="text-[15px] text-[#6B7280] font-medium mb-10 leading-relaxed">
          Run your first Trust Audit to diagnose why Google doesn&apos;t trust your local page.
        </p>
        <RunAuditButton className="bg-[#1D2531] text-white px-10 py-4 rounded-full font-bold text-[15px] hover:bg-black transition-all shadow-lg">
          Run a Trust Audit
        </RunAuditButton>
      </motion.div>
    </div>
  );
}

export default function ReportsPage() {
  const [activeReportId, setActiveReportId] = useState("mock-001");
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState(USE_MOCK ? MOCK_HISTORY : []);

  // 加载左侧历史列表
  useEffect(() => {
    if (USE_MOCK) return;
    fetch("/api/reports")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setHistory(data);
      })
      .catch(() => {});
  }, []);

  // 点击左侧列表 → 加载对应报告
  const fetchReport = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      // TODO: 对接真实 API 后取消注释
      // const res = await fetch(`/api/reports/${id}`);
      // if (!res.ok) throw new Error("Failed to fetch report");
      // const data = await res.json();
      // setReport(data);

      // Mock: 模拟加载延迟
      await new Promise((r) => setTimeout(r, 600));
      setReport({
        id,
        report_id: id === "mock-001" ? "RPT-240712-018" : id === "mock-002" ? "RPT-240712-017" : "RPT-240710-001",
        user_id: "mock",
        url: id === "mock-001" ? "https://example.com/local-plumbing-service" : id === "mock-002" ? "https://simpleanalytics.com/pricing" : "https://ahrefs.com/seo-audit",
        page_type: "Service Page",
        gbp_url: "Connected",
        status: "free_preview",
        trust_status: "Medium",
        trust_status_desc: "FOUNDATIONAL TRUST IN PLACE",
        ranking_potential: "Moderate",
        ranking_potential_desc: "ABLE TO COMPETE, BUT NOT TIER 1",
        risk_level: "Medium-High",
        risk_level_desc: "LEGITIMACY SIGNALS FRAGMENTED",
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
                  The page already aligns with a service intent and includes some degree of local relevance.
                </p>
              </div>
              <div class="p-6 rounded-3xl bg-gray-50 border border-white">
                <h4 class="font-bold mb-2">Main Limitation</h4>
                <p class="text-sm text-gray-500 leading-relaxed font-medium">
                  The page still depends too much on general domain strength.
                </p>
              </div>
            </div>
          </div>
        `,
        stage_3_html: null,
        stage_4_html: null,
        stage_5_html: null,
        created_at: id === "mock-001" ? "2025-07-12T10:30:00Z" : id === "mock-002" ? "2025-07-12T08:15:00Z" : "2025-07-10T14:00:00Z",
      });
    } catch (error) {
      console.error("Failed to fetch report:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 首次加载：有历史则加载第一条，无历史则显示空状态
  useEffect(() => {
    if (history.length > 0 && history[0].items.length > 0) {
      const firstId = history[0].items[0].id;
      setActiveReportId(firstId);
      fetchReport(firstId);
    }
  }, []);

  const handleSelect = (id: string) => {
    setActiveReportId(id);
    fetchReport(id);
  };

  const hasReports = history.length > 0 && history.some((g) => g.items.length > 0);

  if (!hasReports) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#1A212B] selection:bg-[#A5D020]/30">
        <BackHeader />
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-24">
          <EmptyState />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#1A212B] selection:bg-[#A5D020]/30">
      <BackHeader />
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-24 flex gap-10">
        <ReportHistory
          reports={history}
          activeId={activeReportId}
          onSelect={handleSelect}
        />
        {report ? (
          <ReportContent
            report={report}
            isPaid={report.status === "paid_full"}
            isLoading={isLoading}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p className="text-sm font-bold">Select a report to view</p>
          </div>
        )}
      </div>
    </div>
  );
}
