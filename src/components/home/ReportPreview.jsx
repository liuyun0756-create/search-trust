import React from 'react';
import { LogIn, FileText, AlertTriangle, CheckCircle2, Layout, ExternalLink } from 'lucide-react';

export function ReportPreview () {       
  return (
    <section className="py-24 bg-[#F9FAFB]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <div className="text-center mb-16">
          <h2 className="text-[36px] md:text-[42px] font-bold text-[#1A1F2B]">
            See what a Trust Collapse Report looks like
          </h2>
        </div>

        {/* 预览容器 */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          
          {/* 左侧：Input 卡片 */}
          <div className="bg-white rounded-[24px] p-10 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-gray-100">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white">
                <LogIn size={20} />
              </div>
              <h3 className="text-[20px] font-bold text-[#1A1F2B]">Input</h3>
            </div>

            <div className="space-y-8">
              <div>
                <label className="block text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">URL</label>
                <div className="w-full px-4 py-3 bg-[#F3F4F6] border border-gray-200 rounded-lg text-[#1A1F2B] font-medium text-[14px]">
                  /austin-plumber
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Page type</label>
                <div className="w-full px-4 py-3 bg-[#F3F4F6] border border-gray-200 rounded-lg text-[#1A1F2B] font-medium text-[14px]">
                  Local service page
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Google Business Profile</label>
                <div className="w-full px-4 py-3 bg-[#F3F4F6] border border-gray-200 rounded-lg text-[#1A1F2B] font-medium text-[14px]">
                  Austin Plumbing LLC
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：Output 卡片 */}
          <div className="bg-white rounded-[24px] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-[#10B981] flex items-center justify-center text-white">
                <Layout size={20} />
              </div>
              <h3 className="text-[20px] font-bold text-[#1A1F2B]">Output</h3>
            </div>

            {/* 警示框 */}
            <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-5 mb-8">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={16} className="text-[#F97316]" />
                <span className="text-[12px] font-bold text-[#9A3412]">Trust Status</span>
              </div>
              <p className="text-[18px] font-bold text-[#9A3412]">Moderately unstable</p>
            </div>

            {/* 当前层级分析 */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] h-4 bg-[#3B82F6]" />
                <h4 className="text-[14px] font-bold text-[#1A1F2B]">Current Layer</h4>
              </div>
              <p className="text-[14px] font-bold text-gray-700 mb-2">L2 — Weak real-world anchors</p>
              <div className="bg-[#F9FAFB] p-4 rounded-lg border border-gray-100">
                <p className="text-[12px] font-bold text-gray-400 uppercase mb-2">What this means:</p>
                <p className="text-[13px] leading-relaxed text-gray-500">
                  This page may cover the target service, but lacks enough real-world grounding to be interpreted as a stable local entity entry point.
                </p>
              </div>
            </div>

            {/* Google 解释 */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] h-4 bg-[#3B82F6]" />
                <h4 className="text-[14px] font-bold text-[#1A1F2B]">Likely Google interpretation</h4>
              </div>
              <ul className="space-y-2">
                {[
                  'location claim is weakly grounded',
                  'service context feels reusable',
                  'page may not justify standalone existence strongly enough'
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] mt-1.5 shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* 优化建议 */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#3B82F6] flex items-center justify-center text-white scale-50 -ml-2.5">
                  <span className="text-[24px] font-bold">?</span>
                </div>
                <h4 className="text-[14px] font-bold text-[#1A1F2B] -ml-2">Lowest-cost actions</h4>
              </div>
              <ul className="space-y-2">
                {[
                  'add 2—3 city-specific local references',
                  'replace generic intro with a real service situation',
                  'strengthen page-to-entity alignment',
                  'include stronger operational or timeline signals'
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] mt-1.5 shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* 按钮 */}
            <button className="w-full mt-auto py-3.5 bg-[#3B82F6] text-white rounded-xl font-bold text-[14px] hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">
              View Full Sample Report
            </button>
          </div>

        </div>
      </div>
    </section>
  );
};

