"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, ShieldCheck, Zap, AlertTriangle, 
  ChevronRight, Lock, Send, Download, 
  Clock, Globe, Database, BarChart3,
  Loader2, Mail, ExternalLink, ArrowUpRight
} from 'lucide-react';

// --- Types & Mock Data ---
type TabId = 'Executive Summary' | 'Page Level' | 'Key Issues' | 'Six-Layer Model' | 'Optimization Path';

const TABS: TabId[] = ['Executive Summary', 'Page Level', 'Key Issues', 'Six-Layer Model', 'Optimization Path'];

// --- UI Components ---

const LoadingState = ({ text = "Under detection..." }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center py-12 space-y-4">
    <Loader2 className="w-8 h-8 text-[#A5D020] animate-spin" />
    <p className="text-[13px] font-bold text-[#6B7280] tracking-tight uppercase">{text}</p>
  </div>
);

const UnlockOverlay = ({ title, description, hidePricing = false }: { title: string, description: string, hidePricing?: boolean }) => (
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
        {!hidePricing && (
          <button className="bg-white text-[#1D2531] border border-gray-200 px-8 py-3 rounded-full font-bold text-sm hover:bg-gray-50 transition-all">
            View Pricing
          </button>
        )}
      </div>
    </motion.div>
  </div>
);

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('Executive Summary');
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isTabLoading, setIsTabLoading] = useState(false);

  // Initial page load simulation
  useEffect(() => {
    const timer = setTimeout(() => setIsPageLoading(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  // Tab switch loading simulation
  const handleTabChange = (tab: TabId) => {
    if (tab === activeTab) return;
    setIsTabLoading(true);
    setActiveTab(tab);
    setTimeout(() => setIsTabLoading(false), 600);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#1A212B] selection:bg-[#A5D020]/30">
      
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-24 flex gap-10">
        
        {/* 2. Left Sidebar (History) */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#A5D020]" /> 历史报告
          </h3>
          <div className="space-y-8">
            {['April 14, 2026', 'April 12, 2026'].map((date, i) => (
              <div key={i}>
                <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" /> {date}
                </p>
                <div className="space-y-3">
                  {[1, 2, 3].map(item => (
                    <div key={item} className="p-3 rounded-xl hover:bg-white border border-transparent hover:border-gray-100 transition-all cursor-pointer group">
                      <p className="text-[11px] text-blue-500 font-medium truncate mb-1">simpleanalytics.com/pricing</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 italic">Report ID: RPT-240...</span>
                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#A5D020] transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* 3. Main Content Area */}
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
                  <a href="#" className="hover:underline">https://example.com/local-plumbing-service</a>
                  <ExternalLink className="w-3 h-3" />
                </div>
                <div className="flex flex-wrap gap-3">
                  {['Page Type: Service Page', 'GBP URL: Connected', 'Generated: Jul 12, 2025', 'Report ID: RPT-240712-018'].map(tag => (
                    <span key={tag} className="px-4 py-1.5 bg-[#F8F9FA] rounded-full text-[12px] font-bold text-gray-500 border border-gray-50">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
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
            </div>
          </section>

          {/* 4. Top 3 Score Cards (Loading States) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              { label: 'Trust Status', val: 'Medium', desc: 'FOUNDATIONAL TRUST IN PLACE', color: '#3B82F6' },
              { label: 'Ranking Potential', val: 'Medium', desc: 'ABLE TO COMPETE, BUT NOT TIER 1', color: '#A5D020' },
              { label: 'Risk Level', val: 'Medium-High', desc: 'LEGITIMACY SIGNALS FRAGMENTED', color: '#EF4444' }
            ].map((card, i) => (
              <div key={i} className="bg-white rounded-[24px] border border-gray-100 p-8 shadow-sm h-48 relative">
                {isPageLoading ? <LoadingState /> : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-[14px] font-bold text-gray-400 mb-4">{card.label}</p>
                    <h4 className="text-3xl font-black tracking-tighter mb-2" style={{ color: card.color }}>{card.val}</h4>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{card.desc}</p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* 5. Content Tabs Container */}
          <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
            
            {/* Tab Nav */}
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

            {/* Tab Content Area */}
            <div className="p-8 md:p-12 flex-1 relative">
              <AnimatePresence mode="wait">
                {isTabLoading ? (
                  <motion.div 
                    key="loading" 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="h-full flex items-center justify-center py-20"
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
                    {/* --- TAB: Executive Summary --- */}
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

                    {/* --- TAB: Page Level --- */}
                    {activeTab === 'Page Level' && (
                      <div className="space-y-12">
                         <div className="flex items-center gap-4 border-b border-gray-100 pb-8">
                            <div className="w-16 h-16 rounded-[20px] bg-[#F8F9FA] flex items-center justify-center">
                               < Globe className="w-8 h-8 text-[#A5D020]" />
                            </div>
                            <div>
                               <h2 className="text-2xl font-bold tracking-tighter">Page-Specific Analysis</h2>
                               <p className="text-gray-400 text-sm font-medium italic underline">https://simpleanalytics.com/pricing</p>
                            </div>
                         </div>
                         <div className="grid md:grid-cols-2 gap-6">
                            {[
                              { t: 'Entity Strength', d: 'Google can identify what you offer, but identity clarity is low.', icon: <Database /> },
                              { t: 'Local Intent', d: 'The page refers to local geography, but doesn’t feel anchored there.', icon: <Globe /> },
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

                    {/* --- TAB: Key Issues (LOCKED) --- */}
                    {activeTab === 'Key Issues' && (
                      <div className="relative min-h-[400px]">
                        <UnlockOverlay 
                          title="Unlock Full Key Issues" 
                          description="Get the core issue impacts and recommended actions at the key issue hierarchy level."
                        />
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

                    {/* --- TAB: Six-Layer Model (LOCKED) --- */}
                    {activeTab === 'Six-Layer Model' && (
                      <div className="relative min-h-[400px]">
                        <UnlockOverlay 
                          title="Unlock Full Six-Layer Diagnosis" 
                          description="Get the complete layer-by-layer breakdown, hidden weaknesses, and a full local trust interpretation for this page."
                        />
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

                    {/* --- TAB: Optimization Path (LOCKED) --- */}
                    {activeTab === 'Optimization Path' && (
                      <div className="relative min-h-[400px]">
                        <UnlockOverlay 
                          title="Unlock the Full Optimization Path" 
                          description="See the prioritized action plan, execution direction, and complete recommendation sequence for this page."
                        />
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
      </div>

      {/* 6. Simple Footer */}
      <footer className="py-20 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <span className="text-lg font-black italic">Search<span className="text-[#A5D020]">Trust</span></span>
          <p className="text-gray-400 text-sm font-medium">© 2026 SearchTrust. All rights reserved.</p>
          <div className="flex gap-8 text-sm font-bold text-gray-500">
            {['Terms', 'Privacy', 'Refunds'].map(item => (
              <a key={item} href="#" className="hover:text-[#1A212B] transition-colors">{item}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <path d="M19.6 10.2c0-.7-.1-1.4-.2-2H10v3.8h5.4c-.2 1.2-.9 2.1-1.9 2.8v2.3h3c1.8-1.6 2.8-4 2.8-6.9Z" fill="#4285F4"/>
      <path d="M10 20c2.7 0 5-.9 6.6-2.4l-3-2.3c-.8.6-1.9.9-3.6.9-2.7 0-5.1-1.8-5.9-4.3H1.1v2.4C2.8 17.6 6.1 20 10 20Z" fill="#34A853"/>
      <path d="M4.1 11.9c-.2-.6-.3-1.3-.3-1.9s.1-1.3.3-1.9V5.7H1.1C.4 7.1 0 8.5 0 10s.4 2.9 1.1 4.3l3-2.4Z" fill="#FBBC05"/>
      <path d="M10 4.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9C14.9 1 12.7 0 10 0 6.1 0 2.8 2.4 1.1 5.7L4.1 8c.8-2.3 3.1-3.9 5.9-3.9Z" fill="#EA4335"/>
    </svg>
  );
}