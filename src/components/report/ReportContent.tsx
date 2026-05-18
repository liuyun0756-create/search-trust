"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Lock, Send, Download,
  Globe, Loader2, ExternalLink
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

const LoadingState = ({ text = "Under detection..." }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center py-12 space-y-4">
    <Loader2 className="w-8 h-8 text-[#A5D020] animate-spin" />
    <p className="text-[13px] font-bold text-[#6B7280] tracking-tight uppercase">{text}</p>
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
    { label: 'Existing Foundation', value: data.existing_foundation },
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
          <div className="flex items-start gap-2 pb-2">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#1D2531] text-white text-[12px] font-bold flex items-center justify-center">
              1
            </span>
            <div className="text-[16px] font-bold text-[#1A212B]">Primary Trust Failure</div>
          </div>
           <div className="space-y-2">
              <p className="text-[16px] font-bold text-[#1A212B] ">Current main blockage layer: {failure.blocking_layer}</p>
              <p className="text-[14px] text-gray-600 leading-relaxed">{failure.description}</p>
            </div>
        </div>
      )}

      {/* Concrete issues - wrapped in one border card */}
      {issues.length > 0 && (
        <div className="p-6 rounded-[16px] border border-gray-100 space-y-6">
          <div className="flex items-start gap-2 pb-2">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#1D2531] text-white text-[12px] font-bold flex items-center justify-center">
              2
            </span>
            <div className="text-[16px] font-bold text-[#1A212B]">Concrete Issue</div>
          </div>

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
        {layers.map((layer: any, i: number) => (
          <div key={i} className="p-6 rounded-[16px] border border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[15px] font-bold text-[#1A212B]">Layer {i + 1}: {layer.layer_name}</h4>
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
    <div className="space-y-8">
      {/* 1. Primary Trust Blocker */}
      {blocker && (
        <div className="p-6 rounded-[16px] border border-gray-100 space-y-4">
          <div className="flex items-start gap-2 pb-2">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#1D2531] text-white text-[12px] font-bold flex items-center justify-center">
              1
            </span>
            <div className="text-[16px] font-bold text-[#1A212B]">Primary Trust Blocker</div>
          </div>
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
        </div>
      )}

      {/* 2. Must Execute Now */}
      {mustItems.length > 0 && (
        <div className="p-6 rounded-[16px] border border-gray-100 space-y-6">
          <div className="flex items-start gap-2 pb-2">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#1D2531] text-white text-[12px] font-bold flex items-center justify-center">
              2
            </span>
            <div className="text-[16px] font-bold text-[#1A212B]">Must Execute Now</div>
          </div>

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
        </div>
      )}

      {/* 3. Roadmap */}
      {roadmap.length > 0 && (
        <div className="p-6 rounded-[16px] border border-gray-100 space-y-6">
          <div className="flex items-start gap-2 pb-2">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#1D2531] text-white text-[12px] font-bold flex items-center justify-center">
              3
            </span>
            <div className="text-[16px] font-bold text-[#1A212B]">Roadmap</div>
          </div>

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
        </div>
      )}

      {/* 4. If Fix Order Is Wrong */}
      {fixWarning && (
        <div className="p-6 rounded-[16px] border border-gray-100 space-y-4">
          <div className="flex items-start gap-2 pb-2">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#1D2531] text-white text-[12px] font-bold flex items-center justify-center">
              4
            </span>
            <div className="text-[16px] font-bold text-[#1A212B]">{fixWarning.title}</div>
          </div>
          <p className="text-[14px] text-gray-600 leading-relaxed">{fixWarning.intro}</p>
          <div className="space-y-1">
            <p className="text-[13px] font-bold text-gray-500">For this page:</p>
            <p className="text-[14px] text-gray-600 leading-relaxed">{fixWarning.page_specific_risk}</p>
          </div>
          <p className="text-[14px] text-gray-600 leading-relaxed">{fixWarning.closing_warning}</p>
        </div>
      )}

      {/* 5. What You'll Likely See in the Next 30 Days */}
      {expect30 && (
        <div className="p-6 rounded-[16px] border border-gray-100 space-y-4">
          <div className="flex items-start gap-2 pb-2">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#1D2531] text-white text-[12px] font-bold flex items-center justify-center">
              5
            </span>
            <div className="text-[16px] font-bold text-[#1A212B]">{expect30.title}</div>
          </div>
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
    if (isPaid) return false;
    return tab !== 'Executive Summary' && tab !== 'Page Level';
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

  const generatedAt = report.generated_at
    || (report.created_at
      ? new Date(report.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '');

  // 后端返回 JSON 字符串，需 parse
  const parseScoreField = (raw: string | null | undefined) => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

  const trustStatus = parseScoreField(report.trust_status);
  const rankingPotential = parseScoreField(report.ranking_potential);
  const riskLevel = parseScoreField(report.risk_level);

  const scoreCards = [
    {
      label: trustStatus?.label || 'Trust Status',
      val: trustStatus?.value || '—',
      desc: trustStatus?.description || '',
      color: STATUS_COLORS[trustStatus?.value || ''] || '#3B82F6',
    },
    {
      label: rankingPotential?.label || 'Ranking Potential',
      val: rankingPotential?.value || '—',
      desc: rankingPotential?.description || '',
      color: STATUS_COLORS[rankingPotential?.value || ''] || '#A5D020',
    },
    {
      label: riskLevel?.label || 'Risk Level',
      val: riskLevel?.value || '—',
      desc: riskLevel?.description || '',
      color: STATUS_COLORS[riskLevel?.value || ''] || '#EF4444',
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
                {card.desc && <p className="text-[11px]   tracking-widest line-clamp-3">{card.desc}</p>}
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
