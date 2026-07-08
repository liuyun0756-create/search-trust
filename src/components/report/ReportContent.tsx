"use client";

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Lock, Download,
  Loader2, AlertTriangle,
  Share2, Copy, FileText, Link2, CalendarDays, BadgeInfo,
  ShieldCheck, BarChart3, TriangleAlert, ChevronDown, X as XIcon
} from 'lucide-react';
import { normalizeReportToV21 } from '@/lib/report-v21';
import type { Report } from '@/types/database';
import { useAuditModal } from '@/components/common/AuditModalProvider';
import { ReportV21Content, V21_SECTION_IDS, V21_TABS, type V21TabId } from './v21/ReportV21Content';

type TabId = V21TabId;

const TABS: TabId[] = V21_TABS;

const SECTION_IDS: Record<TabId, string> = V21_SECTION_IDS;

interface ReportContentProps {
  report: Report;
  isPaid?: boolean;
  isLoading?: boolean;
  isHeaderLoading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  High: '#22C55E', Strong: '#22C55E',
  Low: '#EF4444', Weak: '#EF4444',
  Medium: '#3B82F6', Moderate: '#A5D020',
  'Medium-High': '#EF4444', 'Medium-Low': '#B45309',
  'Good': '#22C55E', 'Fair': '#B45309', '良好': '#22C55E', '一般': '#F59E0B', '偏弱': '#EF4444',
};

const statusColorFor = (level: string, lowIsPositive = false) => {
  if (level === 'low') return lowIsPositive ? '#22C55E' : '#EF4444';
  if (level === 'high' || level === 'strong') return '#22C55E';
  if (level === 'weak' || level === 'medium_high') return '#EF4444';
  if (level === 'improvable' || level === 'competitive') return '#615FFF';
  return '#3B82F6';
};

const LoadingState = ({ text = "Under detection..." }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center py-12 space-y-4">
    <Loader2 className="w-8 h-8 text-[#A5D020] animate-spin" />
    <p className="text-[13px] font-bold text-[#6B7280] tracking-tight uppercase">{text}</p>
  </div>
);

const HeaderSkeleton = () => (
  <section className="bg-white rounded-[24px] border border-gray-100 p-8 shadow-sm mb-8">
    <div className="flex flex-col md:flex-row justify-between items-start gap-6 animate-pulse">
      <div className="min-w-0 flex-1 w-full">
        <div className="h-9 w-72 bg-gray-100 rounded-xl mb-4" />
        <div className="h-5 w-80 max-w-full bg-gray-100 rounded-lg mb-6" />
        <div className="flex flex-wrap gap-3 mb-3">
          <div className="h-8 w-44 bg-gray-100 rounded-full" />
          <div className="h-8 w-40 bg-gray-100 rounded-full" />
          <div className="h-8 w-48 bg-gray-100 rounded-full" />
        </div>
        <div className="h-20 w-full bg-gray-100 rounded-2xl" />
      </div>
      <div className="hidden md:block w-56 shrink-0 space-y-3">
        <div className="h-12 bg-gray-100 rounded-xl" />
        <div className="h-12 bg-gray-100 rounded-xl" />
      </div>
    </div>
  </section>
);

const FailedState = ({ onRetry }: { onRetry: () => void }) => (
  <div className="bg-white rounded-[24px] border border-red-100 shadow-sm p-10 md:p-12 mb-8">
    <div className="max-w-2xl">
      <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-5">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 className="text-[24px] font-bold tracking-tighter text-[#1A212B] mb-3">
        Report generation stopped
      </h2>
      <p className="text-[14px] text-[#6B7280] font-medium leading-relaxed mb-6">
        The backend stream closed before returning report data, so this report could not be completed. Your audit credit has not been deducted.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-[#1D2531] text-white px-6 py-3 rounded-xl font-bold text-[14px] hover:bg-black transition-all"
      >
        Run a New Audit
      </button>
    </div>
  </div>
);

const UnlockOverlay = ({ title, description }: { title: string; description: string }) => {
  const router = useRouter();
  return (
  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[24px] overflow-hidden">
    <div className="absolute inset-0 bg-white/30 backdrop-blur-[3px]" />
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-white/90 backdrop-blur-sm p-8 md:p-10 rounded-[32px] shadow-2xl border border-white/60 max-w-md text-center"
    >
      <div className="w-12 h-12 bg-[#1D2531] rounded-full flex items-center justify-center mx-auto mb-6">
        <Lock className="text-[#A5D020] w-5 h-5" />
      </div>
      <h3 className="text-2xl font-bold text-[#1D2531] mb-3 tracking-tighter">{title}</h3>
      <p className="text-gray-500 text-[15px] leading-relaxed mb-8">{description}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={() => router.push('/pricing')} className="bg-[#1D2531] text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-black transition-all">
          Unlock Full Report
        </button>
        <button onClick={() => router.push('/pricing')} className="bg-white text-[#1D2531] border border-gray-200 px-8 py-3 rounded-full font-bold text-sm hover:bg-gray-50 transition-all">
          View Pricing
        </button>
      </div>
    </motion.div>
  </div>
  );
};

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
      <div className="rounded-[18px] border border-[#E6EDDA] bg-[#FBFDF5] px-5 py-4">
        <section className="text-[15px] font-black text-[#1A212B]">Primary Blocking Layer：
          <span className="text-[15px] font-black text-orange-700">{data.primary_blocking_layer}</span>
        </section>
      </div>
      {/* Main conclusion */}
      <div className="rounded-[22px] border border-blue-100 bg-blue-50/50 p-8 shadow-[0_12px_30px_rgba(59,130,246,0.06)]">
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
        <p className="text-[15px] text-gray-600 leading-relaxed font-medium">{data.explanation}</p>
      </div>
    </div>
  );
}

// ============================================================
// Module 2: Page Level
// ============================================================
function Module2PageLevel({ data }: { data: Record<string, any> }) {
  const cards = [
    { label: 'Observed Strength', value: data.existing_foundation },
    { label: 'Main Limitation', value: data.main_limitation },
    { label: 'Likely Search Outcome', value: data.likely_search_outcome },
    { label: 'Competitive Interpretation', value: data.competitive_interpretation },
  ];

  return (
    <div className="space-y-8">
      <div>
        <section className="text-[16px]  text-[#1A212B] mb-2">
          <span className="font-bold">current Assessment：</span>
          <span className="text-[16px] ">{data?.current_assessment}</span>
        </section>
      </div>
      {/* Page level indicator */}
      {/* <div className="p-6 rounded-[16px] bg-gray-50 border border-gray-100">
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Overall Level</p>
        <p className="text-[20px] font-bold text-[#1A212B]">{data.page_level}</p>
      </div> */}

      {/* 2x2 + 1 grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <div key={card.label} className="p-6 rounded-[16px] bg-gray-50 border border-gray-100">
            <h4 className="text-[13px] font-bold  uppercase tracking-wider mb-3">{card.label}</h4>
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
function KeyIssueStepHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="mb-4 rounded-[16px] border border-[#E2EFC8] bg-[#FBFDF5] px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.035)]">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#A5D020] text-[19px] font-black text-[#1A212B] shadow-[0_6px_12px_rgba(165,208,32,0.22)]">
          {number}
        </span>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#8BAA2B]">
            Step {number}
          </p>
          <h3 className="text-[19px] font-black leading-tight text-[#1A212B] md:text-[22px]">
            {title}
          </h3>
        </div>
      </div>
    </div>
  );
}

function Module3KeyProblems({ data }: { data: Record<string, any> }) {
  const failure = data.primary_trust_failure;
  const issues: any[] = data.concrete_issues || [];

  return (
    <div className="space-y-8">
       <section className="text-[16px]  text-[#1A212B] mb-2">
          <span className="text-[16px] ">Trust builds sequentially.Fixing the wrong layer first will limit the effectiveness of all subsequent work.</span>
        </section>
      {/* Primary trust failure */}
      {failure && (
        <div className="p-6 rounded-[16px] border border-gray-100">
          <KeyIssueStepHeader number="1" title="Primary Trust Failure" />
           <div className="space-y-2">
              <p className="text-[16px] font-bold text-[#1A212B] ">Current main blockage layer: {failure.blocking_layer}</p>
              <p className="text-[14px] text-gray-600 leading-relaxed">{failure.description}</p>
            </div>
        </div>
      )}

      {/* Concrete issues - wrapped in one border card */}
      {issues.length > 0 && (
        <div className="p-6 rounded-[16px] border border-gray-100 space-y-6">
          <KeyIssueStepHeader number="2" title="Concrete Issue" />

          {issues.map((issue: any, i: number) => (
            <div key={i} className="space-y-4">
              <h4 className="text-[16px] font-bold text-[#1A212B]">{i + 1}. {issue.title}</h4>
              <p className="text-[14px] text-gray-600 leading-relaxed">{issue.judgement}</p>
              <p className="text-[14px] text-gray-600 leading-relaxed">{issue.explanation}</p>

              {issue.impacts?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-gray-500">Impacts</p>
                  <ul className="space-y-1.5">
                    {issue.impacts.map((impact: string, j: number) => (
                      <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-400 mt-2" />
                        {impact}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {issue.suggestions?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-gray-500">Suggestions</p>
                  <ul className="space-y-1.5">
                    {issue.suggestions.map((suggestion: string, j: number) => (
                      <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#A5D020] mt-2" />
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {i < issues.length - 1 && <div className="border-b border-gray-100" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Module 4: Eight Layers
// ============================================================
function Module4EightLayers({ data }: { data: Record<string, any> }) {
  const layers: any[] = data.layers || [];
  const visibleLayers = layers
    .map((layer, index) => ({ ...layer, originalIndex: index }))
    .filter((layer) => layer.originalIndex !== 1 && layer.originalIndex !== 2);
  const layerTitles: Record<number, string> = {
    0: 'L0-Relevance',
    3: 'L1-Entity Clarity',
    4: 'L2-Proof Signals',
    5: 'L3-Local Fit',
    6: 'L4-Strutural Trust',
    7: 'L5-Standalone Value',
  };

  const statusTagClass: Record<string, string> = {
    Good: 'bg-green-50 text-green-700',
    Fair: 'bg-yellow-50 text-yellow-700',
    Weak: 'bg-red-50 text-red-700',
    Moderate: 'bg-[#F0F5E0] text-[#7B9A1E]',
    'Medium-High': 'bg-orange-50 text-orange-700',
  };

  return (
    <section>
      <section className="text-[16px]  text-[#1A212B] mb-2 pb-2">
        <span className="text-[16px] ">Below is the full six-layer trust diagnosis used to interpret the current strength of the page.</span>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleLayers.map((layer: any) => (
          <div key={layer.originalIndex} className="p-6 rounded-[16px] border border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[15px] font-bold text-[#1A212B]">
                {layerTitles[layer.originalIndex] || `Layer ${layer.originalIndex + 1}: ${layer.layer_name}`}
              </h4>
              <span className={`text-[12px] font-bold px-3 py-1 rounded-full ${statusTagClass[layer.status] || 'bg-gray-50 text-gray-600'}`}>
                {layer.status}
              </span>
            </div>
            <p className="text-[14px] text-gray-600 leading-relaxed">{layer.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function OptimizationStepCard({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[#E4EDD2] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
      <div className="mb-5 rounded-[16px] border border-[#E8F1D6] bg-[#F8FAF2] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#A5D020] text-[13px] font-black text-[#1A212B] shadow-sm">
            {number}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8BAA2B]">Step {number}</p>
            <div className="mt-1 text-[16px] font-black leading-tight text-[#1A212B]">{title}</div>
          </div>
        </div>
      </div>

      <div className={`space-y-4 overflow-hidden pr-1 transition-all duration-300 ${expanded ? 'max-h-[1200px]' : 'max-h-[180px]'}`}>
        {children}
      </div>

      {!expanded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/95 to-white/0" />
      )}

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="relative z-10 mt-5 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-[12px] font-bold text-[#1A212B] shadow-sm transition-all hover:border-[#A5D020] hover:bg-[#F8FAF5]"
      >
        {expanded ? 'Collapse' : 'Expand'}
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
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
    <div className="grid grid-cols-1 gap-5">
      {/* 1. Primary Trust Blocker */}
      {blocker && (
        <OptimizationStepCard number="1" title="Primary Trust Blocker">
          <p className="text-[16px] font-bold text-[#1A212B]">Current blocking layer: {blocker.blocking_layer}</p>
          <p className="text-[14px] text-gray-600 leading-relaxed">{blocker.summary}</p>

          {blocker.direct_consequences?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[13px] font-bold text-gray-500">As a result:</p>
              <ul className="space-y-1.5">
                {blocker.direct_consequences.map((c: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] text-gray-600">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-400 mt-2" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-[13px] font-bold text-gray-500">Why this layer cannot be skipped:</p>
            <p className="text-[14px] text-gray-600 leading-relaxed">{blocker.why_cannot_skip}</p>
          </div>
        </OptimizationStepCard>
      )}

      {/* 2. Must Execute Now */}
      {mustItems.length > 0 && (
        <OptimizationStepCard number="2" title="Must Execute Now">
          {mustItems.map((item: any, i: number) => (
            <div key={i} className="space-y-4">
              <h4 className="text-[16px] font-bold text-[#1A212B]">Must Fix {i + 1}- {item.title}</h4>

              <div className="space-y-1">
                <p className="text-[13px] font-bold text-gray-500">Why now:</p>
                <p className="text-[14px] text-gray-600 leading-relaxed">{item.why_now}</p>
              </div>

              {item.execution_focus?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-gray-500">Execution focus:</p>
                  <ul className="space-y-1.5">
                    {item.execution_focus.map((action: string, j: number) => (
                      <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#A5D020] mt-2" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {item.completion_signals?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-gray-500">Completion signals:</p>
                  <ul className="space-y-1.5">
                    {item.completion_signals.map((signal: string, j: number) => (
                      <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#A5D020] mt-2" />
                        {signal}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {item.expected_impact?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-gray-500">Expected impact:</p>
                  <ul className="space-y-1.5">
                    {item.expected_impact.map((impact: string, j: number) => (
                      <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#A5D020] mt-2" />
                        {impact}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {i < mustItems.length - 1 && <div className="border-b border-gray-100" />}
            </div>
          ))}
        </OptimizationStepCard>
      )}

      {/* 3. Roadmap */}
      {roadmap.length > 0 && (
        <OptimizationStepCard number="3" title="Roadmap">
          {roadmap.map((phase: any, i: number) => (
            <div key={i} className="space-y-4">
              <h4 className="text-[16px] font-bold text-[#1A212B]">Phase {i + 1}- {phase.phase_title}</h4>

              <div className="space-y-1">
                <p className="text-[13px] font-bold text-gray-500">Entry condition:</p>
                <p className="text-[14px] text-gray-600 leading-relaxed">{phase.entry_condition}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[13px] font-bold text-gray-500">Goal:</p>
                <p className="text-[14px] text-gray-600 leading-relaxed">{phase.goal}</p>
              </div>

              {phase.key_actions?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-gray-500">Key actions:</p>
                  <ul className="space-y-1.5">
                    {phase.key_actions.map((action: string, j: number) => (
                      <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#A5D020] mt-2" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {phase.expected_outcomes?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-gray-500">Expected outcomes:</p>
                  <ul className="space-y-1.5">
                    {phase.expected_outcomes.map((outcome: string, j: number) => (
                      <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#A5D020] mt-2" />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {i < roadmap.length - 1 && <div className="border-b border-gray-100" />}
            </div>
          ))}
        </OptimizationStepCard>
      )}

      {/* 4. If Fix Order Is Wrong */}
      {fixWarning && (
        <OptimizationStepCard number="4" title={fixWarning.title}>
          <p className="text-[14px] text-gray-600 leading-relaxed">{fixWarning.intro}</p>
          <div className="space-y-1">
            <p className="text-[13px] font-bold text-gray-500">For this page:</p>
            <p className="text-[14px] text-gray-600 leading-relaxed">{fixWarning.page_specific_risk}</p>
          </div>
          <p className="text-[14px] text-gray-600 leading-relaxed">{fixWarning.closing_warning}</p>
        </OptimizationStepCard>
      )}

      {/* 5. What You'll Likely See in the Next 30 Days */}
      {expect30 && (
        <OptimizationStepCard number="5" title={expect30.title}>
          <p className="text-[14px] text-gray-600 leading-relaxed">{expect30.intro}</p>

          {expect30.week_1_2?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[13px] font-bold text-gray-500">Week 1–2:</p>
              <ul className="space-y-1.5">
                {expect30.week_1_2.map((item: string, j: number) => (
                  <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 mt-2" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {expect30.week_2_3?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[13px] font-bold text-gray-500">Week 2–3:</p>
              <ul className="space-y-1.5">
                {expect30.week_2_3.map((item: string, j: number) => (
                  <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 mt-2" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {expect30.week_3_4?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[13px] font-bold text-gray-500">Week 3–4:</p>
              <ul className="space-y-1.5">
                {expect30.week_3_4.map((item: string, j: number) => (
                  <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 mt-2" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {expect30.end_of_30_days?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[13px] font-bold text-gray-500">By the end of 30 days:</p>
              <ul className="space-y-1.5">
                {expect30.end_of_30_days.map((item: string, j: number) => (
                  <li key={j} className="flex items-start gap-2 text-[14px] text-gray-600">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 mt-2" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[14px] text-gray-600 leading-relaxed">{expect30.closing_note}</p>
        </OptimizationStepCard>
      )}
    </div>
  );
}

// ============================================================
// Module Renderer - routes to correct component
// ============================================================
function renderModule(tab: TabId, data: Record<string, any>) {
  switch (tab) {
    case 'Overall Conclusion': return <Module1Overview data={data} />;
    case 'Page Level': return <Module2PageLevel data={data} />;
    case 'Key Issues': return <Module3KeyProblems data={data} />;
    case 'Trust Layer Breakdown': return <Module4EightLayers data={data} />;
    case 'Optimization Path': return <Module5Optimization data={data} />;
    case 'Data Coverage': return <SectionSkeleton />;
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
      <div className="relative min-h-[300px] overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="border-b border-gray-100 bg-[#F8FAF5] px-8 py-5 md:px-12">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1.5 rounded-full bg-[#A5D020]" />
            <h2 className="text-[22px] font-black tracking-tight text-[#1A212B]">{tab}</h2>
          </div>
        </div>

        <div className="p-8 md:p-12">
          {isLoading ? (
            <LoadingState text={`Analyzing ${tab}...`} />
          ) : isLocked ? (
            <div className="relative min-h-[300px]">
              <UnlockOverlay
                title={`Unlock ${tab}`}
                description={`Get the complete ${tab.toLowerCase()} analysis, detailed breakdowns, and actionable recommendations for this page.`}
              />
              <div className="opacity-50 blur-[4px] pointer-events-none select-none">
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
  isHeaderLoading = false,
}: ReportContentProps) {
  const [activeTab, setActiveTab] = useState<TabId>('Overall Conclusion');
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'downloading'>('idle');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const isClickScrolling = useRef(false);
  const { openAuditForm } = useAuditModal();
  const isFailed = report.status === 'failed';
  const showFailed = isFailed && !isLoading;
  const normalized = normalizeReportToV21(report);
  const reportV21 = normalized.reportV21;
  const overallStatus = reportV21.overall_status ?? {
    label: 'Unknown',
    level: 'medium',
    explanation: 'No structured trust status was available.',
  };
  const rankingPotential = reportV21.ranking_potential ?? {
    label: 'Unknown',
    level: 'competitive',
    explanation: 'No structured ranking potential was available.',
  };
  const riskLevel = reportV21.risk_level ?? {
    label: 'Unknown',
    level: 'medium',
    explanation: 'No structured risk level was available.',
  };

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

  const generatedAt = report.generated_at
    || (report.created_at
      ? new Date(report.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '');
  const displayReportId = report.external_report_id || report.report_id;
  const isSampleReport = displayReportId?.toLowerCase().includes('sample');

  const shareUrl = typeof window !== 'undefined' ? window.location.href : report.page_url;
  const shareTitle = `SearchTrust ${isSampleReport ? 'Sample ' : ''}Report`;
  const socialShareLinks = [
    {
      label: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
  ];

  const handleShareReport = () => {
    setShareModalOpen(true);
  };

  const isGbpStatusLoading = report.status === 'pending' && typeof report.gbp_connected !== 'boolean';
  const normalizedGbpStatus = reportV21.gbp_status?.status || 'not_checked';
  const gbpStatus = isGbpStatusLoading
    ? {
        value: (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking
          </span>
        ),
        tone: 'text-gray-400',
        iconTone: 'text-gray-400',
        iconBg: 'bg-gray-50',
      }
    : normalizedGbpStatus === 'checked'
      ? {
          value: 'Connected',
          tone: 'text-emerald-500',
          iconTone: 'text-emerald-500',
          iconBg: 'bg-emerald-50',
        }
      : normalizedGbpStatus === 'not_found'
        ? {
            value: 'Not found',
            tone: 'text-red-500',
            iconTone: 'text-red-500',
            iconBg: 'bg-red-50',
          }
        : normalizedGbpStatus === 'error'
          ? {
              value: 'Error',
              tone: 'text-red-500',
              iconTone: 'text-red-500',
              iconBg: 'bg-red-50',
            }
        : {
            value: 'Not checked',
            tone: 'text-gray-500',
            iconTone: 'text-gray-500',
            iconBg: 'bg-gray-50',
          };

  const scoreCards = [
    {
      label: 'Trust Status',
      val: overallStatus.label || '—',
      desc: overallStatus.explanation || '',
      color: statusColorFor(overallStatus.level),
      icon: ShieldCheck,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
    },
    {
      label: 'Ranking Potential',
      val: rankingPotential.label || '—',
      desc: rankingPotential.explanation || '',
      color: statusColorFor(rankingPotential.level),
      icon: BarChart3,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-500',
    },
    {
      label: 'Risk Level',
      val: riskLevel.label || '—',
      desc: riskLevel.explanation || '',
      color: statusColorFor(riskLevel.level, true),
      icon: TriangleAlert,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
    },
  ];

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

  const handleDownloadPDF = async () => {
    if (pdfStatus === 'downloading') return;
    setPdfStatus('downloading');
    try {
      const res = await fetch(`/api/reports/${report.id}/pdf`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'PDF export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const reportId = report.external_report_id || report.report_id;
      const a = document.createElement('a');
      a.href = url;
      a.download = `SearchTrust-${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF export error:', error);
      alert(error instanceof Error ? error.message : 'PDF export failed');
    } finally {
      setPdfStatus('idle');
    }
  };

  return (
    <main className="flex-1 min-w-0">
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] border border-gray-100 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.22)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[22px] font-black text-[#1A212B]">Share report</h2>
                <p className="mt-1 text-[13px] font-medium leading-relaxed text-gray-500">
                  Send this report by email or share it on social media.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="rounded-full border border-gray-100 p-2 text-gray-400 transition-all hover:bg-gray-50 hover:text-[#1A212B]"
                aria-label="Close share dialog"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">
                Email address
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-[14px] font-medium text-[#1A212B] outline-none transition-all placeholder:text-gray-400 focus:border-[#A5D020] focus:ring-4 focus:ring-[#A5D020]/10"
                />
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={!email || emailStatus === 'sending'}
                  className="rounded-xl bg-[#1A212B] px-5 py-3 text-[14px] font-bold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {emailStatus === 'sending' ? 'Sending...' : 'Send'}
                </button>
              </div>
              {emailStatus === 'sent' && (
                <p className="text-[13px] font-bold text-green-600">Report sent.</p>
              )}
              {emailStatus === 'error' && (
                <p className="text-[13px] font-bold text-red-500">Unable to send. Please try again.</p>
              )}
            </div>

            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="mb-3 text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">
                Share to social
              </p>
              <div className="grid grid-cols-3 gap-3">
                {socialShareLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] font-bold text-[#1A212B] transition-all hover:border-[#A5D020] hover:bg-[#F8FAF2]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Report Info Card */}
      {isHeaderLoading ? (
        <HeaderSkeleton />
      ) : (
      <section className="mb-8 rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <h1 className="text-[30px] font-black leading-tight tracking-tight text-[#1A1F2B] md:text-[40px]">
            Trust Audit Report{isSampleReport ? ' (Sample)' : ''}
          </h1>

          {isPaid && (
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                onClick={handleDownloadPDF}
                disabled={pdfStatus === 'downloading' || report.status === 'pending'}
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#171B22] px-6 py-3 text-[14px] font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_14px_28px_rgba(15,23,42,0.16)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pdfStatus === 'downloading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {pdfStatus === 'downloading' ? 'Preparing...' : 'Export PDF'}
              </button>
              <button
                type="button"
                onClick={handleShareReport}
                className="inline-flex items-center justify-center gap-2.5 rounded-xl border border-[#1A1F2B]/60 bg-white px-6 py-3 text-[14px] font-bold text-[#1A1F2B] transition-all hover:-translate-y-0.5 hover:border-[#A5D020] hover:bg-[#F7F9F2]"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            </div>
          )}
        </div>

        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[#A5D020] bg-[#FBFFF1] px-4 py-3 text-[14px] font-medium text-[#6B7280]">
          <a
            href={report.page_url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate hover:text-[#1A1F2B]"
            title={report.page_url}
          >
            {report.page_url}
          </a>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(report.page_url)}
            className="shrink-0 rounded-lg p-1.5 text-[#657083] transition-colors hover:bg-white hover:text-[#1A1F2B]"
            aria-label="Copy report URL"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>

        <div className="grid overflow-hidden rounded-2xl border border-gray-200 bg-white md:grid-cols-4">
          {[
            {
              icon: FileText,
              label: 'Page Type',
              value: report.page_type || 'Service Page',
              tone: 'text-blue-500',
            },
            {
              icon: Link2,
              label: 'GBP URL Status',
              value: gbpStatus.value,
              tone: gbpStatus.tone,
              iconTone: gbpStatus.iconTone,
              iconBg: gbpStatus.iconBg,
            },
            {
              icon: CalendarDays,
              label: 'Generated',
              value: generatedAt || '—',
              tone: 'text-[#1A1F2B]',
            },
            {
              icon: BadgeInfo,
              label: 'Report ID',
              value: displayReportId,
              tone: 'text-[#1A1F2B]',
            },
          ].map((item, index) => (
            <div
              key={item.label}
              className={`flex items-center gap-4 px-5 py-5 ${
                index > 0 ? 'border-t border-gray-200 md:border-l md:border-t-0' : ''
              }`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.iconBg || 'bg-blue-50'} ${item.iconTone || item.tone}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="mb-1.5 text-[12px] font-bold text-[#8A96A8]">{item.label}</p>
                <p className={`truncate text-[12px] font-bold ${item.tone}`}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {showFailed && <FailedState onRetry={openAuditForm} />}

      {/* Score Cards */}
      {!showFailed && <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {scoreCards.map((card, i) => {
          const Icon = card.icon;

          return (
            <div key={i} className="relative min-h-[235px] rounded-[22px] border border-gray-200 bg-white p-6 shadow-sm">
              {isLoading ? <LoadingState /> : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full flex-col">
                  <div className="mb-5 flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg} ${card.iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="text-[17px] font-bold leading-tight tracking-tight text-[#1A1F2B]">{card.label}</p>
                      <BadgeInfo className="h-4 w-4 shrink-0 text-[#9AA6B8]" />
                    </div>
                  </div>

                  <h4 className="mb-5 text-[32px] font-black leading-none tracking-tight" style={{ color: card.color }}>
                    {card.val}
                  </h4>

                  {card.desc && (
                    <p className="text-[15px] font-medium leading-7 text-[#465264]">
                      {card.desc}
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>}

      {/* Sticky Tab Bar */}
      {!showFailed && <div className="sticky top-[72px] z-20 bg-white rounded-[24px] border border-gray-100 shadow-sm mb-8">
        <div className="grid grid-cols-1 gap-2 rounded-[24px] bg-[#F8F9FA] p-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => scrollToSection(tab)}
              className={`relative rounded-xl px-3 py-3.5 text-[13px] font-bold leading-tight transition-all ${
                activeTab === tab
                  ? 'bg-[#1A1F2B] text-white shadow-sm'
                  : 'bg-white text-gray-400 hover:bg-white hover:text-[#1A1F2B]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>}

      {/* All Sections */}
      {!showFailed && (
        <ReportV21Content
          normalized={normalized}
          rawReport={report}
          isLoading={isLoading}
        />
      )}
    </main>
  );
}
