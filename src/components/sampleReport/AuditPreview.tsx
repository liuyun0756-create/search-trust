"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Target, AlertTriangle, Layers, Wrench } from 'lucide-react';

export function AuditPreview() {
  const [activeTab, setActiveTab] = useState('summary');

  const tabs = [
    { id: 'summary', label: 'Overall Summary', icon: <ShieldCheck size={16} /> },
    { id: 'level', label: 'Page Level', icon: <Target size={16} /> },
    { id: 'issues', label: 'Key Issues', icon: <AlertTriangle size={16} /> },
    { id: 'layers', label: 'Six-Layer Model', icon: <Layers size={16} /> },
    { id: 'fixes', label: 'Fix Plan', icon: <Wrench size={16} /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'summary':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* 状态简报卡片 */}
            <div className="bg-[#F8F9FA] rounded-2xl p-6 border border-gray-100">
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-[14px] font-medium text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A5D020]" />
                  Current Status: Medium-Low / Medium / Good
                </li>
                <li className="flex items-center gap-3 text-[14px] font-medium text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A5D020]" />
                  Ranking Potential: Competitive / Room for Growth / Strong Competitiveness
                </li>
                <li className="flex items-center gap-3 text-[14px] font-medium text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A5D020]" />
                  Risk Level: Medium / Medium-High / Low
                </li>
              </ul>
            </div>

            {/* 核心结论文字 */}
            <div className="bg-[#F8F9FA] rounded-2xl p-6 border border-gray-100">
              <p className="text-[15px] leading-relaxed text-gray-700 font-medium">
                Your page meets the basic conditions to compete in local search, but it is not yet a high-trust local business page.
                It has basic service relevance and local targeting, but still has clear shortcomings in entity trust, real-world connections, and standalone page value.
              </p>
            </div>

            {/* 可能遇到的问题列表 */}
            <div className="bg-[#F8F9FA] rounded-2xl p-6 border border-gray-100">
              <h4 className="text-[14px] font-bold text-gray-900 mb-4">What you are more likely experiencing:</h4>
              <ul className="space-y-3">
                {['Page gets indexed, but rankings are unstable', 'Some keywords appear in results, but struggle to climb steadily', 'Heavily dependent on overall site authority', 'Easily outranked by competitors with stronger local signals'].map((text, i) => (
                  <li key={i} className="flex items-start gap-3 text-[14px] text-gray-500 leading-snug">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400" />
                    {text} 
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        );
      default:
        return <div className="p-12 text-center text-gray-400">Content for {activeTab} is loading...</div>;
    }
  };

  return (
    <section className="pt-24 bg-white">
      <div className="container mx-auto max-w-6xl px-6">
        <h2 className="text-center text-[32px] md:text-[40px] font-bold text-[#1A1F2B] mb-12">
          See What a Local Trust Audit Looks Like
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 左侧：固定信息栏 */}
          <div className="lg:col-span-3 space-y-4">
            {[
              { label: 'URL', value: 'https://nxtlvlautospa.com/' },
              { label: 'Type', value: 'Local Service Page' },
              { label: 'GBP URL', value: 'https://nxtlvlautospa.com/' },
            ].map((info, i) => (
              <div key={i} className="bg-[#F3F4F6] rounded-xl p-5 border border-gray-100">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">{info.label}</p>
                <p className="text-[13px] font-bold text-gray-800 break-all">{info.value}</p>
              </div>
            ))}
          </div>

          {/* 右侧：交互标签页 */}
          <div className="lg:col-span-9">
            {/* Tab 导航 */}
            <div className="flex flex-wrap gap-2 mb-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold transition-all ${
                    activeTab === tab.id 
                    ? 'bg-[#2D2E32] text-white shadow-lg shadow-gray-200' 
                    : 'bg-white border border-gray-100 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 内容显示区 */}
            <div className="min-h-[400px]">
              <AnimatePresence mode="wait">
                {renderContent()}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}