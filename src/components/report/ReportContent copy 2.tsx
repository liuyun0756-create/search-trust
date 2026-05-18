"use client";

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Lock, Send, Download,
  Globe, Loader2, ExternalLink,
  ChevronRight, AlertTriangle, CheckCircle2, XCircle, Clock, ArrowRight
} from 'lucide-react';
import type { Report } from '@/types/database';

type TabId = 'Executive Summary' | 'Page Level' | 'Key Issues' | 'Six-Layer Model' | 'Optimization Path';

const TABS: TabId[] = ['Executive Summary', 'Page Level', 'Key Issues', 'Six-Layer Model', 'Optimization Path'];

const SECTION_IDS: Record<TabId, string> = {
  'Executive Summary': 'section-executive-summary',
  'Page Level': 'section-page-level',
  'Key Issues': 'section-key-issues',
  'Six-Layer Model': 'section-six-layer-model',
  'Optimization Path': 'section-optimization-path',
};

interface ReportContentProps {
  report: Report;
  isPaid?: boolean;
  isLoading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  High: '#22C55E', Strong: '#22C55E',
  Low: '#EF4444', Weak: '#EF4444',
  Medium: '#3B82F6', Moderate: '#A5D020',
  'Medium-High': '#EF4444', 'Medium-Low': '#F59E0B',
  'Good': '#22C55E', 'Fair': '#F59E0B', '良好': '#22C55E', '一般': '#F59E0B', '偏弱': '#EF4444',
};

const STATUS_BG: Record<string, string> = {
  'Good': 'bg-green-50 border-green-200 text-green-700',
  'Fair': 'bg-yellow-50 border-yellow-200 text-yellow-700',
  'Weak': 'bg-red-50 border-red-200 text-red-700',
  '良好': 'bg-green-50 border-green-200 text-green-700',
  '一般': 'bg-yellow-50 border-yellow-200 text-yellow-700',
  '偏弱': 'bg-red-50 border-red-200 text-red-700',
};

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

function SectionSkeleton() {
  return (
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
  );
}

// ============================================================
// Module 1: Executive Summary
// ============================================================
function Module1Overview({ data }: { data: Record<string, any> }) {
  return (
    <div className="space-y-8">
      <div>
        <section className="text-[16px] font-bold text-[#1A212B] mb-2">Primary Blocking Layer：
                  <span className="text-[16px] font-bold text-orange-700">{data.primary_blocking_layer}</span>

        </section>
      </div>
      {/* Main conclusion */}
      <div className="p-8 bg-blue-50/50 rounded-[24px] border border-blue-100">
        <p className="text-[17px] font-medium leading-relaxed text-gray-800 italic">
          "{data.main_conclusion}"
        </p>
      </div>

      {/* Key metrics */}
      <ul className="space-y-3">
        <li className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[data.current_status] || '#3B82F6' }} />
          <span className="text-[14px] text-gray-500 font-medium">Current Status:</span>
          <span className="text-[14px] font-bold" style={{ color: STATUS_COLORS[data.current_status] || '#3B82F6' }}>{data.current_status}</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[data.ranking_potential] || '#A5D020' }} />
          <span className="text-[14px] text-gray-500 font-medium">Ranking Potential:</span>
          <span className="text-[14px] font-bold" style={{ color: STATUS_COLORS[data.ranking_potential] || '#A5D020' }}>{data.ranking_potential}</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[data.risk_level] || '#EF4444' }} />
          <span className="text-[14px] text-gray-500 font-medium">Risk Level:</span>
          <span className="text-[14px] font-bold" style={{ color: STATUS_COLORS[data.risk_level] || '#EF4444' }}>{data.risk_level}</span>
        </li>
      </ul>

      {/* Explanation */}
      <div className="space-y-3">
        <h4 className="text-[13px] font-bold text-gray-400 uppercase tracking-wider">Explanation</h4>
        <p className="text-[15px] text-gray-600 leading-relaxed font-medium">{data.explanation}</p>
      </div>

      {/* Primary blocking layer */}
      {/* <div className="p-6 rounded-[16px] bg-orange-50 border border-orange-100">
        <p className="text-[12px] font-bold text-orange-500 uppercase tracking-wider mb-2">Primary Blocking Layer</p>
      </div> */}
    </div>
  );
}

// ============================================================
// Module 2: Page Level
// ============================================================
function Module2PageLevel({ data }: { data: Record<string, any> }) {
  const cards = [
    { label: 'Current Assessment', value: data.current_assessment },
    { label: 'Existing Foundation', value: data.existing_foundation },
    { label: 'Main Limitation', value: data.main_limitation },
    { label: 'Likely Search Outcome', value: data.likely_search_outcome },
    { label: 'Competitive Interpretation', value: data.competitive_interpretation },
  ];

  return (
    <div className="space-y-8">
      {/* Page level indicator */}
      <div className="p-6 rounded-[16px] bg-gray-50 border border-gray-100">
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Overall Level</p>
        <p className="text-[20px] font-bold text-[#1A212B]">{data.page_level}</p>
      </div>

      {/* 2x2 + 1 grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <div key={card.label} className="p-6 rounded-[16px] bg-gray-50 border border-gray-100">
            <h4 className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-3">{card.label}</h4>
            <p className="text-[14px] text-gray-600 leading-relaxed font-medium">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Module 3: Key Issues
// ============================================================
function Module3KeyProblems({ data }: { data: Record<string, any> }) {
  const failure = data.primary_trust_failure;
  const issues: any[] = data.concrete_issues || [];

  return (
    <div className="space-y-8">
      {/* Primary trust failure */}
      {failure && (
        <div className="p-6 rounded-[16px] bg-red-50 border border-red-100">
          <p className="text-[12px] font-bold text-red-500 uppercase tracking-wider mb-2">Primary Trust Failure</p>
          <p className="text-[14px] font-bold text-red-700 mb-2">{failure.blocking_layer}</p>
          <p className="text-[14px] text-red-600 leading-relaxed">{failure.description}</p>
        </div>
      )}

      {/* Concrete issues */}
      {issues.map((issue: any, i: number) => (
        <div key={i} className="border border-gray-100 rounded-[16px] p-6 space-y-4">
          <h4 className="text-[16px] font-bold text-[#1A212B]">{issue.title}</h4>
          <div className="p-4 rounded-xl bg-gray-50">
            <p className="text-[13px] font-bold text-gray-500 mb-1">Google's Judgement</p>
            <p className="text-[14px] text-gray-700 leading-relaxed">{issue.judgement}</p>
          </div>
          <p className="text-[14px] text-gray-600 leading-relaxed">{issue.explanation}</p>

          {/* Impacts */}
          {issue.impacts?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Impacts</p>
              <ul className="space-y-2">
                {issue.impacts.map((impact: string, j: number) => (
                  <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                    <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    {impact}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {issue.suggestions?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Suggestions</p>
              <ul className="space-y-2">
                {issue.suggestions.map((suggestion: string, j: number) => (
                  <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                    <CheckCircle2 size={16} className="text-[#A5D020] shrink-0 mt-0.5" />
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Module 4: Eight Layers
// ============================================================
function Module4EightLayers({ data }: { data: Record<string, any> }) {
  const layers: any[] = data.layers || [];

  return (
    <div className="space-y-4">
      {layers.map((layer: any, i: number) => {
        const statusClass = STATUS_BG[layer.status] || 'bg-gray-50 border-gray-200 text-gray-700';
        return (
          <div key={i} className={`p-6 rounded-[16px] border ${statusClass}`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[15px] font-bold">{layer.layer_name}</h4>
              <span className={`text-[12px] font-bold px-3 py-1 rounded-full ${statusClass}`}>{layer.status}</span>
            </div>
            <p className="text-[14px] leading-relaxed opacity-80">{layer.description}</p>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Module 5: Optimization Path
// ============================================================
function Module5Optimization({ data }: { data: Record<string, any> }) {
  const blocker = data.primary_trust_blocker;
  const mustItems: any[] = data.must_execute_now?.items || [];
  const roadmap: any[] = data.roadmap || [];
  const fixWarning = data.if_fix_order_is_wrong;
  const expect30 = data.what_to_expect_30_days;

  return (
    <div className="space-y-10">
      {/* Primary blocker */}
      {blocker && (
        <div className="space-y-4">
          <h3 className="text-[18px] font-bold text-[#1A212B]">Primary Trust Blocker</h3>
          <div className="p-6 rounded-[16px] bg-red-50 border border-red-100">
            <p className="text-[16px] font-bold text-red-700 mb-2">{blocker.blocking_layer}</p>
            <p className="text-[14px] text-red-600 leading-relaxed mb-4">{blocker.summary}</p>
            {blocker.direct_consequences?.length > 0 && (
              <ul className="space-y-1">
                {blocker.direct_consequences.map((c: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] text-red-600">
                    <ChevronRight size={16} className="shrink-0 mt-0.5" />
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-[14px] text-gray-500 leading-relaxed italic">{blocker.why_cannot_skip}</p>
        </div>
      )}

      {/* Must execute now */}
      {mustItems.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[18px] font-bold text-[#1A212B]">Must Execute Now</h3>
          {mustItems.map((item: any, i: number) => (
            <div key={i} className="p-6 rounded-[16px] bg-[#A5D020]/5 border border-[#A5D020]/20 space-y-4">
              <h4 className="text-[15px] font-bold text-[#1A212B]">{item.title}</h4>
              <p className="text-[14px] text-gray-600 leading-relaxed">{item.why_now}</p>
              {item.execution_focus?.length > 0 && (
                <ul className="space-y-2">
                  {item.execution_focus.map((action: string, j: number) => (
                    <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                      <CheckCircle2 size={16} className="text-[#A5D020] shrink-0 mt-0.5" />
                      {action}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Roadmap */}
      {roadmap.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[18px] font-bold text-[#1A212B]">Optimization Roadmap</h3>
          {roadmap.map((phase: any, i: number) => (
            <div key={i} className="p-6 rounded-[16px] border border-gray-100 space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#1D2531] text-white text-[12px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <h4 className="text-[15px] font-bold text-[#1A212B]">{phase.phase_title}</h4>
              </div>
              <p className="text-[13px] text-gray-400 pl-10">Entry condition: {phase.entry_condition}</p>
              <p className="text-[14px] text-gray-600 leading-relaxed pl-10">{phase.goal}</p>
              {phase.key_actions?.length > 0 && (
                <ul className="space-y-2 pl-10">
                  {phase.key_actions.map((action: string, j: number) => (
                    <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                      <ArrowRight size={14} className="text-[#A5D020] shrink-0 mt-1" />
                      {action}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fix order warning */}
      {fixWarning && (
        <div className="p-6 rounded-[16px] bg-orange-50 border border-orange-100 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" />
            <h4 className="text-[15px] font-bold text-orange-700">{fixWarning.title}</h4>
          </div>
          <p className="text-[14px] text-orange-600 leading-relaxed">{fixWarning.intro}</p>
          <p className="text-[14px] text-orange-700 leading-relaxed font-medium">{fixWarning.page_specific_risk}</p>
          <p className="text-[13px] text-orange-600 leading-relaxed italic">{fixWarning.closing_warning}</p>
        </div>
      )}

      {/* 30 days expectation */}
      {expect30 && (
        <div className="p-6 rounded-[16px] border border-gray-100 space-y-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-gray-400" />
            <h4 className="text-[15px] font-bold text-[#1A212B]">{expect30.title}</h4>
          </div>
          <p className="text-[14px] text-gray-500 leading-relaxed">{expect30.intro}</p>

          {[
            { label: 'Week 1-2', items: expect30.week_1_2 },
            { label: 'Week 2-3', items: expect30.week_2_3 },
            { label: 'Week 3-4', items: expect30.week_3_4 },
            { label: 'End of 30 days', items: expect30.end_of_30_days },
          ].map((phase) => (
            phase.items?.length > 0 && (
              <div key={phase.label} className="space-y-2 pl-4 border-l-2 border-gray-100">
                <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">{phase.label}</p>
                <ul className="space-y-1">
                  {phase.items.map((item: string, j: number) => (
                    <li key={j} className="text-[14px] text-gray-600 leading-relaxed">• {item}</li>
                  ))}
                </ul>
              </div>
            )
          ))}

          {expect30.closing_note && (
            <p className="text-[13px] text-gray-400 italic">{expect30.closing_note}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Module Renderer - routes to correct component
// ============================================================
function renderModule(tab: TabId, data: Record<string, any>) {
  switch (tab) {
    case 'Executive Summary': return <Module1Overview data={data} />;
    case 'Page Level': return <Module2PageLevel data={data} />;
    case 'Key Issues': return <Module3KeyProblems data={data} />;
    case 'Six-Layer Model': return <Module4EightLayers data={data} />;
    case 'Optimization Path': return <Module5Optimization data={data} />;
  }
}

// ============================================================
// Section wrapper
// ============================================================
function ModuleSection({
  tab,
  data,
  isLocked,
  isLoading,
}: {
  tab: TabId;
  data: Record<string, any> | null;
  isLocked: boolean;
  isLoading: boolean;
}) {
  return (
    <div id={SECTION_IDS[tab]} className="scroll-mt-24">
      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-8 md:p-12 relative min-h-[300px]">
        <h2 className="text-[20px] font-bold text-[#1A212B] mb-6">{tab}</h2>

        {isLoading ? (
          <LoadingState text={`Analyzing ${tab}...`} />
        ) : isLocked ? (
          <div className="relative min-h-[300px]">
            <UnlockOverlay
              title={`Unlock ${tab}`}
              description={`Get the complete ${tab.toLowerCase()} analysis, detailed breakdowns, and actionable recommendations for this page.`}
            />
            <div className="opacity-20 blur-[3px] pointer-events-none select-none">
              {data ? renderModule(tab, data) : <SectionSkeleton />}
            </div>
          </div>
        ) : data ? (
          renderModule(tab, data)
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm font-bold">No data available for this section.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================
export function ReportContent({
  report,
  isPaid = false,
  isLoading = false,
}: ReportContentProps) {
  const [activeTab, setActiveTab] = useState<TabId>('Executive Summary');
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const isClickScrolling = useRef(false);

  // 滚动时自动高亮对应的 tab
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    TABS.forEach((tab) => {
      const el = document.getElementById(SECTION_IDS[tab]);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !isClickScrolling.current) {
            setActiveTab(tab);
          }
        },
        { rootMargin: '-100px 0px -60% 0px' }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const isLocked = (tab: TabId) => {
    // TODO: 样式调完后恢复锁逻辑
    // if (isPaid) return false;
    // return tab !== 'Executive Summary' && tab !== 'Page Level';
    return false;
  };

  const scrollToSection = (tab: TabId) => {
    setActiveTab(tab);
    isClickScrolling.current = true;
    const el = document.getElementById(SECTION_IDS[tab]);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => {
      isClickScrolling.current = false;
    }, 800);
  };

  const generatedAt = report.created_at
    ? new Date(report.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const overview = report.module_1_overview;

  const scoreCards = [
    {
      label: 'Trust Status',
      val: overview?.current_status || '—',
      desc: overview?.main_conclusion || '',
      color: STATUS_COLORS[overview?.current_status || ''] || '#3B82F6',
    },
    {
      label: 'Ranking Potential',
      val: overview?.ranking_potential || '—',
      desc: '',
      color: STATUS_COLORS[overview?.ranking_potential || ''] || '#A5D020',
    },
    {
      label: 'Risk Level',
      val: overview?.risk_level || '—',
      desc: '',
      color: STATUS_COLORS[overview?.risk_level || ''] || '#EF4444',
    },
  ];

  const moduleMap: Record<TabId, Record<string, any> | null> = {
    'Executive Summary': report.module_1_overview,
    'Page Level': report.module_2_page_level,
    'Key Issues': report.module_3_key_problems,
    'Six-Layer Model': report.module_4_eight_layers,
    'Optimization Path': report.module_5_optimization,
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
              <a href={report.page_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{report.page_url}</a>
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

      {/* Sticky Tab Bar */}
      <div className="sticky top-[72px] z-20 bg-white rounded-[24px] border border-gray-100 shadow-sm mb-8">
        <div className="flex bg-[#F8F9FA] p-2 gap-1 overflow-x-auto rounded-[24px]">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => scrollToSection(tab)}
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
      </div>

      {/* All Sections */}
      <div className="space-y-8">
        {TABS.map((tab) => (
          <ModuleSection
            key={tab}
            tab={tab}
            data={moduleMap[tab]}
            isLocked={isLocked(tab)}
            isLoading={isLoading}
          />
        ))}
      </div>
    </main>
  );
}
