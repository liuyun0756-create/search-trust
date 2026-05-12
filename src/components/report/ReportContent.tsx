"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Send, Download,
  Globe, Loader2, ExternalLink
} from 'lucide-react';
import type { Report } from '@/types/database';

type TabId = 'Executive Summary' | 'Page Level' | 'Key Issues' | 'Six-Layer Model' | 'Optimization Path';

const TABS: TabId[] = ['Executive Summary', 'Page Level', 'Key Issues', 'Six-Layer Model', 'Optimization Path'];

interface ReportContentProps {
  report: Report;
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

const STATUS_COLORS: Record<string, string> = {
  High: '#22C55E',
  Strong: '#22C55E',
  Low: '#EF4444',
  Weak: '#EF4444',
  Medium: '#3B82F6',
  Moderate: '#A5D020',
  'Medium-High': '#EF4444',
  'Medium-Low': '#F59E0B',
};

export function ReportContent({
  report,
  isPaid = false,
  isLoading = false,
}: ReportContentProps) {
  const [activeTab, setActiveTab] = useState<TabId>('Executive Summary');
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

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

  const generatedAt = report.created_at
    ? new Date(report.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const scoreCards = [
    {
      label: 'Trust Status',
      val: report.trust_status || '—',
      desc: report.trust_status_desc || '',
      color: STATUS_COLORS[report.trust_status || ''] || '#3B82F6',
    },
    {
      label: 'Ranking Potential',
      val: report.ranking_potential || '—',
      desc: report.ranking_potential_desc || '',
      color: STATUS_COLORS[report.ranking_potential || ''] || '#A5D020',
    },
    {
      label: 'Risk Level',
      val: report.risk_level || '—',
      desc: report.risk_level_desc || '',
      color: STATUS_COLORS[report.risk_level || ''] || '#EF4444',
    },
  ];

  const stageHtmlMap: Record<TabId, string | null> = {
    'Executive Summary': report.stage_1_html,
    'Page Level': report.stage_2_html,
    'Key Issues': report.stage_3_html,
    'Six-Layer Model': report.stage_4_html,
    'Optimization Path': report.stage_5_html,
  };

  const handleSendEmail = async () => {
    if (!email || emailStatus === 'sending') return;
    setEmailStatus('sending');
    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id, email }),
      });
      if (!res.ok) throw new Error();
      setEmailStatus('sent');
      setTimeout(() => setEmailStatus('idle'), 3000);
    } catch {
      setEmailStatus('error');
      setTimeout(() => setEmailStatus('idle'), 3000);
    }
  };

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
              <a href={report.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{report.url}</a>
              <ExternalLink className="w-3 h-3" />
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                ...(report.page_type ? [`Page Type: ${report.page_type}`] : []),
                ...(report.gbp_url ? [`GBP URL: ${report.gbp_url}`] : []),
                ...(generatedAt ? [`Generated: ${generatedAt}`] : []),
                `Report ID: ${report.report_id}`,
              ].map(tag => (
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Send to email"
                  className="w-full bg-[#F8F9FA] border border-gray-100 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-[#A5D020]/20"
                />
                <button
                  onClick={handleSendEmail}
                  disabled={emailStatus === 'sending' || !email}
                  className={`absolute right-2 top-2 p-1.5 rounded-lg transition-all shadow-sm ${
                    emailStatus === 'sent'
                      ? 'bg-green-50 text-green-500'
                      : emailStatus === 'error'
                      ? 'bg-red-50 text-red-500'
                      : 'bg-white border border-gray-100 text-gray-400 hover:text-[#A5D020]'
                  }`}
                >
                  {emailStatus === 'sending' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : emailStatus === 'sent' ? (
                    <span className="text-xs font-bold">✓</span>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {scoreCards.map((card, i) => (
          <div key={i} className="bg-white rounded-[24px] border border-gray-100 p-8 shadow-sm h-48 relative">
            {isLoading ? <LoadingState /> : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="text-[14px] font-bold text-gray-400 mb-4">{card.label}</p>
                <h4 className="text-3xl font-black tracking-tighter mb-2" style={{ color: card.color }}>{card.val}</h4>
                {card.desc && <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest line-clamp-3">{card.desc}</p>}
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
                {isLocked(activeTab) ? (
                  <div className="relative min-h-[400px]">
                    <UnlockOverlay
                      title={`Unlock Full ${activeTab}`}
                      description={`Get the complete ${activeTab.toLowerCase()} analysis, detailed breakdowns, and actionable recommendations for this page.`}
                    />
                    <div className="opacity-20 blur-[3px] pointer-events-none select-none">
                      {stageHtmlMap[activeTab] ? (
                        <div dangerouslySetInnerHTML={{ __html: stageHtmlMap[activeTab]! }} />
                      ) : (
                        <div className="space-y-6">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex gap-4 p-4 border-b border-gray-100">
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 w-1/3 rounded" />
                                <div className="h-3 bg-gray-100 w-full rounded" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  stageHtmlMap[activeTab] ? (
                    <div className="report-content" dangerouslySetInnerHTML={{ __html: stageHtmlMap[activeTab]! }} />
                  ) : (
                    <div className="text-center py-20 text-gray-400">
                      <p className="text-sm font-bold">No data available for this section.</p>
                    </div>
                  )
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
