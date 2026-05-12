"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Zap, AlertTriangle,
  Lock, Send, Download,
  Globe, Database, BarChart3,
  Loader2, ExternalLink
} from 'lucide-react';

type TabId = 'Executive Summary' | 'Page Level' | 'Key Issues' | 'Six-Layer Model' | 'Optimization Path';

const TABS: TabId[] = ['Executive Summary', 'Page Level', 'Key Issues', 'Six-Layer Model', 'Optimization Path'];

interface ReportContentProps {
  url?: string;
  pageType?: string;
  gbpUrl?: string;
  reportId?: string;
  score?: number;
  isPaid?: boolean;
  isLoading?: boolean;
}

const LoadingState = ({ text = "Under detection..." }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center py-12 space-y-4">
    <Loader2 className="w-8 h-8 text-[#A5D020] animate-spin" />
    <p className="text-[13px] font-bold text-[#6B7280] tracking-tight uppercase">{text}</p>
  </div>
);

const UnlockOverlay = ({ title, description }: { title: string; description: string }) => (
  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[24px] overflow-hidden">
    <div className="absolute inset-0 bg-white/40 backdrop-blur-md" />
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-white p-8 md:p-10 rounded-[32px] shadow-2xl border border-gray-100 max-w-md text-center"
    >
      <div className="w-12 h-12 bg-[#1D2531] rounded-full flex items-center justify-center mx-auto mb-6">
        <Lock className="text-[#A5D020] w-5 h-5" />
      </div>
      <h3 className="text-2xl font-bold text-[#1D2531] mb-3 tracking-tighter">{title}</h3>
      <p className="text-gray-500 text-[15px] leading-relaxed mb-8">{description}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button className="bg-[#1D2531] text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-black transition-all">
          Unlock Full Report
        </button>
        <button className="bg-white text-[#1D2531] border border-gray-200 px-8 py-3 rounded-full font-bold text-sm hover:bg-gray-50 transition-all">
          View Pricing
        </button>
      </div>
    </motion.div>
  </div>
);

export function ReportContent({
  url = "https://example.com/local-plumbing-service",
  pageType = "Service Page",
  gbpUrl = "Connected",
  reportId = "RPT-240712-018",
  isPaid = false,
  isLoading = false,
}: ReportContentProps) {
  const [activeTab, setActiveTab] = useState<TabId>('Executive Summary');
  const [isTabLoading, setIsTabLoading] = useState(false);

  const handleTabChange = (tab: TabId) => {
    if (tab === activeTab) return;
    setIsTabLoading(true);
    setActiveTab(tab);
    setTimeout(() => setIsTabLoading(false), 600);
  };

  const isLocked = (tab: TabId) => {
    if (isPaid) return false;
    return tab !== 'Executive Summary' && tab !== 'Page Level';
  };

  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <main className="flex-1 min-w-0">
      {/* Top Report Info Card */}
      <section className="bg-white rounded-[24px] border border-gray-100 p-8 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-[32px] font-bold tracking-tighter">Trust Audit Report</h1>
              <span className="bg-[#A5D020]/10 text-[#A5D020] px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter">Beta</span>
            </div>
            <div className="flex items-center gap-2 text-blue-500 font-bold text-[15px] mb-6">
              <Globe className="w-4 h-4" />
              <a href="#" className="hover:underline">{url}</a>
              <ExternalLink className="w-3 h-3" />
            </div>
            <div className="flex flex-wrap gap-3">
              {[`Page Type: ${pageType}`, `GBP URL: ${gbpUrl}`, `Generated: ${now}`, `Report ID: ${reportId}`].map(tag => (
                <span key={tag} className="px-4 py-1.5 bg-[#F8F9FA] rounded-full text-[12px] font-bold text-gray-500 border border-gray-50">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          {isPaid && (
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <button className="bg-[#1D2531] text-white flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold hover:shadow-lg transition-all">
                <Download className="w-4 h-4" /> Export PDF
              </button>
              <div className="relative group">
                <input
                  type="email"
                  placeholder="Send to email"
                  className="w-full bg-[#F8F9FA] border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#A5D020]/20"
                />
                <button className="absolute right-2 top-2 p-1.5 bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-[#A5D020] transition-colors shadow-sm">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Trust Status', val: 'Medium', desc: 'FOUNDATIONAL TRUST IN PLACE', color: '#3B82F6' },
          { label: 'Ranking Potential', val: 'Medium', desc: 'ABLE TO COMPETE, BUT NOT TIER 1', color: '#A5D020' },
          { label: 'Risk Level', val: 'Medium-High', desc: 'LEGITIMACY SIGNALS FRAGMENTED', color: '#EF4444' }
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-[24px] border border-gray-100 p-8 shadow-sm h-48 relative">
            {isLoading ? <LoadingState /> : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="text-[14px] font-bold text-gray-400 mb-4">{card.label}</p>
                <h4 className="text-3xl font-black tracking-tighter mb-2" style={{ color: card.color }}>{card.val}</h4>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{card.desc}</p>
              </motion.div>
            )}
          </div>
        ))}
      </div>

      {/* Content Tabs */}
      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
        <div className="flex bg-[#F8F9FA] p-2 gap-1 border-b border-gray-100 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`relative px-6 py-3.5 rounded-xl text-[14px] font-bold whitespace-nowrap transition-all ${
                activeTab === tab ? 'text-[#1A212B]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="tab-bg"
                  className="absolute inset-0 bg-white shadow-sm rounded-xl -z-10 border border-gray-100"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="p-8 md:p-12 flex-1 relative">
          <AnimatePresence mode="wait">
            {isTabLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full flex items-center justify-center py-32"
              >
                <LoadingState text={`Analyzing ${activeTab}...`} />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {/* Executive Summary */}
                {activeTab === 'Executive Summary' && (
                  <div className="space-y-10">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tighter mb-4 flex items-center gap-3">
                        <Zap className="text-[#A5D020] w-5 h-5" /> Executive Summary
                      </h2>
                      <div className="p-8 bg-blue-50/50 rounded-[24px] border border-blue-100">
                        <p className="text-[17px] font-medium leading-relaxed text-[#1D2531]">
                          "Google can understand what you offer, but cannot consistently confirm who you are.
                          As a result, trust signals cannot accumulate properly."
                        </p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="text-[14px] font-black uppercase text-gray-400 tracking-widest">Current Assessment</h4>
                        <p className="text-[15px] font-medium leading-relaxed">
                          Your page sits above the basic participation threshold, but below the level typically associated with strong, trust-rich local landing pages.
                        </p>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-[14px] font-black uppercase text-gray-400 tracking-widest">Impact Pattern</h4>
                        <ul className="space-y-2">
                          {['Brand binding is weak', 'Local signal efficiency is low', 'Rankings lack stability'].map(text => (
                            <li key={text} className="flex items-center gap-3 text-[14px] font-bold">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Page Level */}
                {activeTab === 'Page Level' && (
                  <div className="space-y-12">
                    <div className="flex items-center gap-4 border-b border-gray-100 pb-8">
                      <div className="w-16 h-16 rounded-[20px] bg-[#F8F9FA] flex items-center justify-center">
                        <Globe className="w-8 h-8 text-[#A5D020]" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold tracking-tighter">Page-Specific Analysis</h2>
                        <p className="text-gray-400 text-sm font-medium italic underline">{url}</p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      {[
                        { t: 'Entity Strength', d: 'Google can identify what you offer, but identity clarity is low.', icon: <Database /> },
                        { t: 'Local Intent', d: 'The page refers to local geography, but doesn\'t feel anchored there.', icon: <Globe /> },
                        { t: 'Service accountability', d: 'Page introduces service without deep commitment or boundaries.', icon: <ShieldCheck /> },
                        { t: 'Standalone value', d: 'Page risks being perceived as a template if not differentiated.', icon: <BarChart3 /> },
                      ].map((item, i) => (
                        <div key={i} className="p-6 rounded-[24px] bg-[#F8F9FA] border border-white hover:border-gray-200 transition-all flex gap-4">
                          <div className="p-3 bg-white rounded-xl shadow-sm text-[#A5D020] h-fit">{item.icon}</div>
                          <div>
                            <h4 className="font-bold mb-2">{item.t}</h4>
                            <p className="text-[13px] text-gray-500 leading-relaxed font-medium">{item.d}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Issues (LOCKED) */}
                {activeTab === 'Key Issues' && isLocked('Key Issues') && (
                  <div className="relative min-h-[400px]">
                    <UnlockOverlay title="Unlock Full Key Issues" description="Get the core issue impacts and recommended actions at the key issue hierarchy level." />
                    <div className="opacity-20 pointer-events-none select-none blur-[2px]">
                      <h2 className="text-2xl font-bold mb-6">Key Issues Detected</h2>
                      <div className="space-y-6">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="flex gap-4 p-4 border-b border-gray-100">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-gray-200 w-1/3 rounded" />
                              <div className="h-3 bg-gray-100 w-full rounded" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Six-Layer Model (LOCKED) */}
                {activeTab === 'Six-Layer Model' && isLocked('Six-Layer Model') && (
                  <div className="relative min-h-[400px]">
                    <UnlockOverlay title="Unlock Full Six-Layer Diagnosis" description="Get the complete layer-by-layer breakdown, hidden weaknesses, and a full local trust interpretation for this page." />
                    <div className="opacity-20 blur-[3px] pointer-events-none">
                      <div className="grid grid-cols-2 gap-8">
                        {[1,2,3,4,5,6].map(i => (
                          <div key={i} className="p-8 border border-gray-100 rounded-[24px]">
                            <div className="w-12 h-12 bg-gray-100 rounded-full mb-4" />
                            <div className="h-4 bg-gray-200 w-1/2 rounded mb-3" />
                            <div className="space-y-2">
                              <div className="h-3 bg-gray-100 w-full rounded" />
                              <div className="h-3 bg-gray-100 w-2/3 rounded" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Optimization Path (LOCKED) */}
                {activeTab === 'Optimization Path' && isLocked('Optimization Path') && (
                  <div className="relative min-h-[400px]">
                    <UnlockOverlay title="Unlock the Full Optimization Path" description="See the prioritized action plan, execution direction, and complete recommendation sequence for this page." />
                    <div className="opacity-20 blur-[4px] pointer-events-none">
                      <div className="space-y-12">
                        {[1,2,3].map(i => (
                          <div key={i} className="p-10 bg-gray-50 rounded-[32px]">
                            <div className="h-6 bg-gray-200 w-1/4 rounded mb-6" />
                            <div className="space-y-4">
                              <div className="h-4 bg-gray-100 w-full rounded" />
                              <div className="h-4 bg-gray-100 w-full rounded" />
                              <div className="h-4 bg-gray-100 w-3/4 rounded" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
