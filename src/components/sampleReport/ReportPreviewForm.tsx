"use client";

import { useState } from 'react';
import { LogIn, Layout, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function ReportPreviewForm() {
  const [formData, setFormData] = useState({
    url: 'https://nxtlvlautospa.com/',
    pageType: 'Local service page',
    gbpUrl: '',
  });

  return (
    <section id="report-preview" className="py-24 bg-[#F9FAFB]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-[36px] md:text-[42px] font-bold text-[#1A1F2B]">
            See what a SearchTrust report looks like
          </h2>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">

          {/* 左侧：Input */}
          <div className="bg-white rounded-[24px] p-10 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-gray-100">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white">
                <LogIn size={20} />
              </div>
              <h3 className="text-[20px] font-bold text-[#1A1F2B]">Input</h3>
            </div>

            <div className="space-y-8">
              <div>
                <label className="block text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  URL <span className="text-[#3B82F6]">required</span>
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-4 py-3 bg-[#F3F4F6] border border-gray-200 rounded-lg text-[#1A1F2B] font-medium text-[14px] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/20 transition-colors"
                  placeholder="https://example.com/page"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Page Type
                </label>
                <select
                  value={formData.pageType}
                  onChange={(e) => setFormData({ ...formData, pageType: e.target.value })}
                  className="w-full px-4 py-3 bg-[#F3F4F6] border border-gray-200 rounded-lg text-[#1A1F2B] font-medium text-[14px] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/20 transition-colors appearance-none"
                >
                  <option>Local service page</option>
                  <option>City / location-intent landing page</option>
                  <option>Service-area page</option>
                  <option>Location landing page</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  GBP URL <span className="text-[#9CA3AF]">optional / recommended</span>
                </label>
                <input
                  type="url"
                  value={formData.gbpUrl}
                  onChange={(e) => setFormData({ ...formData, gbpUrl: e.target.value })}
                  className="w-full px-4 py-3 bg-[#F3F4F6] border border-gray-200 rounded-lg text-[#1A1F2B] font-medium text-[14px] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/20 transition-colors"
                  placeholder="Google Business Profile URL"
                />
              </div>
            </div>
          </div>

          {/* 右侧：Output */}
          <div className="bg-white rounded-[24px] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-[#A5D020] flex items-center justify-center text-white">
                <Layout size={20} />
              </div>
              <h3 className="text-[20px] font-bold text-[#1A1F2B]">Output</h3>
              <span className="ml-auto text-[11px] font-bold text-[#A5D020] bg-[#A5D020]/10 px-2.5 py-1 rounded-full">Beta</span>
            </div>

            {/* Trust Status */}
            <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-5 mb-8">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={16} className="text-[#F97316]" />
                <span className="text-[12px] font-bold text-[#9A3412]">Trust Status</span>
              </div>
              <p className="text-[18px] font-bold text-[#9A3412]">中等偏弱 — 中等不稳定</p>
            </div>

            {/* Current Layer */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] h-4 bg-[#3B82F6]" />
                <h4 className="text-[14px] font-bold text-[#1A1F2B]">Dominant failure layer</h4>
              </div>
              <p className="text-[14px] font-bold text-[#6B7280] mb-2">L2 — Weak real-world anchors</p>
              <div className="bg-[#F9FAFB] p-4 rounded-lg border border-gray-100">
                <p className="text-[13px] leading-relaxed text-gray-500">
                  这页已经具备基本的服务相关性和本地指向性，但在实体信任、现实连接和页面独立价值上仍有明显短板。
                </p>
              </div>
            </div>

            {/* Key Issues by Layer */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] h-4 bg-[#3B82F6]" />
                <h4 className="text-[14px] font-bold text-[#1A1F2B]">Key issues by layer</h4>
              </div>
              <ul className="space-y-2">
                {[
                  'location claim is weakly grounded',
                  'service context feels reusable',
                  'page may not justify standalone existence strongly enough',
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] mt-1.5 shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Lowest-cost actions */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] h-4 bg-[#A5D020]" />
                <h4 className="text-[14px] font-bold text-[#1A1F2B]">Prioritized fix path</h4>
              </div>
              <ul className="space-y-2">
                {[
                  'add 2–3 city-specific local references',
                  'replace generic intro with a real service situation',
                  'strengthen page-to-entity alignment',
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-gray-600">
                    <CheckCircle2 size={14} className="text-[#A5D020] mt-0.5 shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <button className="w-full mt-auto py-3.5 bg-[#3B82F6] text-white rounded-xl font-bold text-[14px] hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">
              View Full Sample Report
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}
