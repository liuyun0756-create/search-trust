"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Target, AlertTriangle, Layers, Wrench } from 'lucide-react';

export function AuditPreview() {
  const [activeTab, setActiveTab] = useState('summary');

  const tabs = [
    { id: 'summary', label: '总体结论', icon: <ShieldCheck size={16} /> },
    { id: 'level', label: '页面水平', icon: <Target size={16} /> },
    { id: 'issues', label: '重点问题', icon: <AlertTriangle size={16} /> },
    { id: 'layers', label: '六层架构', icon: <Layers size={16} /> },
    { id: 'fixes', label: 'Trust 修复执行方案', icon: <Wrench size={16} /> },
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
                  当前状态：中等偏弱 / 中等 / 良好 
                </li>
                <li className="flex items-center gap-3 text-[14px] font-medium text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A5D020]" />
                  排名潜力：可参与竞争 / 有提升空间 / 具备较强竞争力 
                </li>
                <li className="flex items-center gap-3 text-[14px] font-medium text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A5D020]" />
                  风险等级：中 / 中高 / 低 
                </li>
              </ul>
            </div>

            {/* 核心结论文字 */}
            <div className="bg-[#F8F9FA] rounded-2xl p-6 border border-gray-100">
              <p className="text-[15px] leading-relaxed text-gray-700 font-medium">
                你的页面具备参与本地搜索竞争的基础条件，但目前还不是一个高信任的本地业务页面。
                这页已经具备基本的服务相关性和本地指向性，但在实体信任、现实连接和页面独立价值上仍有明显短板。 
              </p>
            </div>

            {/* 可能遇到的问题列表 */}
            <div className="bg-[#F8F9FA] rounded-2xl p-6 border border-gray-100">
              <h4 className="text-[14px] font-bold text-gray-900 mb-4">你当前更可能遇到的是：</h4>
              <ul className="space-y-3">
                {['页面能收录，但排名不稳定', '某些词能进入结果页，但难以持续上升', '对网站整体权重依赖较高', '遇到本地信号更强的竞争页时容易被超过'].map((text, i) => (
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
    <section className="py-20 bg-white">
      <div className="container mx-auto max-w-6xl px-6">
        <h2 className="text-center text-[32px] md:text-[40px] font-bold text-[#1A1F2B] mb-12">
          See What a Local Trust Audit Looks Like
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 左侧：固定信息栏 */}
          <div className="lg:col-span-3 space-y-4">
            {[
              { label: 'URL', value: 'https://nxtlvlautospa.com/' },
              { label: '类型', value: '本地服务页' },
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