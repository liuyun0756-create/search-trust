"use client";

import React, { useState } from 'react';

const statusColors = {
  'Medium-Low': '#F59E0B',
  'Low potential': '#A5D020',
  'Medium-High risk': '#EF4444',
};

const reportTabs = [
  {
    label: 'Executive Summary',
    title: 'Executive Summary',
    type: 'executiveSummary',
    summary: {
      primary_blocking_layer: 'Entity Presence (L0-A)',
      current_status: 'Medium-Low',
      ranking_potential: 'Low potential',
      risk_level: 'Medium-High risk',
      main_conclusion:
        'Your page qualifies for local search competition, but is not yet a high-trust local business page.',
      explanation:
        'The page has foundational capabilities, such as a clear topic and service direction, but shows visible gaps in entity presence and specificity. These gaps cause the page to be interpreted as lacking real-world identity traces, limiting trust accumulation and ranking stability in local search.',
    },
  },
  {
    label: 'Page Level',
    title: 'Page Level',
    type: 'pageLevel',
    pageLevel: {
      current_assessment:
        'The page has some local search competition foundation, but trust structure is thin, especially in entity feel and specificity.',
      existing_foundation:
        'The page has built basic capabilities such as clear topic direction and good algorithm adaptation.',
      main_limitation:
        'The page has not yet established strong entity presence or real-world anchors.',
      likely_search_outcome:
        'In low-competition environments, the page may gain some ranking opportunities, but in high-competition settings, it will struggle against pages with higher trust.',
      competitive_interpretation:
        'Against stronger competitors, the trust gap will be amplified, especially in queries requiring entity verification and specific scenario support.',
    },
  },
  {
    label: 'Key Issues',
    title: 'Key Issues',
    type: 'keyIssues',
    keyIssues: {
      intro:
        'Trust builds sequentially. Fixing the wrong layer first will limit the effectiveness of all subsequent work.',
      primary_trust_failure: {
        blocking_layer: 'Entity Consistency Layer (L0-B)',
        summary:
          'Google can understand what you offer, but cannot consistently confirm who you are. As a result, trust signals cannot accumulate properly.',
      },
      concrete_issues: [
        {
          title: '1 - Entity presence is not strong enough',
          body:
            'The page explains what you do, but it does not clearly confirm who is responsible for the service. It contains service information, but business identity signals are still not expressed consistently enough.',
          impact: [
            'The brand-to-page relationship is weak',
            'Local business signals carry less weight',
            'Ranking stability is limited',
          ],
          actions: [
            'Unify brand name, company name, and contact information',
            'Clarify who provides this service',
            'Check consistency across the homepage, contact page, About page, and this page',
          ],
        },
        {
          title: '2 - Local grounding is insufficient',
          body:
            'The page mentions the local area, but it does not yet feel like the service actually happens there. If real scenarios, local context, and service delivery details are missing, the page can feel generic or template-based.',
          impact: [
            'Local relevance becomes harder to prove',
            'The page may appear to be covering a city rather than serving it',
            'It becomes easier for competitors to copy the page format',
          ],
          actions: [
            'Add real local service scenarios',
            'Improve local FAQ content',
            'Explain how the service actually happens in this area',
          ],
        },
        {
          title: '3 - Accountability signals are not strong enough',
          body:
            'The page describes services, but does not sufficiently show process, boundaries, limitations, applicable situations, or next steps.',
          impact: [
            'User conversion efficiency may drop',
            'Page trust remains weak',
            'The page looks more like a marketing page than a service entry point',
          ],
          actions: [
            'Add service workflow explanations',
            'Clarify boundaries and important notes',
            'Improve the accountability logic before and after the CTA',
          ],
        },
        {
          title: '4 - Standalone value is not clear enough',
          body:
            'The page exists, but it has not fully proven why it deserves to exist on its own. If it is too similar to other location pages, Google may interpret it as coverage for more keywords rather than a page built for a distinct local need.',
          impact: [
            'Long-term page value is weak',
            'It may compete with related pages',
            'Independent ranking potential is limited',
          ],
          actions: [
            'Clarify the local need this page serves',
            'Differentiate it from other service or location pages',
            'Add locally specific content and expression',
          ],
        },
      ],
    },
  },
  {
    label: 'Six-Layer Model',
    title: 'Six-Layer Model',
    type: 'sixLayerModel',
    sixLayerModel: {
      intro:
        'Below is the full six-layer trust diagnosis used to interpret the current strength of the page.',
      layers: [
        {
          title: 'L0-Relevance',
          status: 'Good',
          description: 'The page has clear topic direction and service positioning.',
        },
        {
          title: 'L1-Entity Clarity',
          status: 'Fair',
          description: 'Page content is too generic, lacking local context language.',
        },
        {
          title: 'L2-Proof Signals',
          status: 'Fair',
          description: 'The page has weak connection to geographic space.',
        },
        {
          title: 'L3-Local Fit',
          status: 'Weak',
          description: 'The page focuses more on meeting search demand than taking real-world responsibility.',
        },
        {
          title: 'L4-Strutural Trust',
          status: 'Good',
          description: 'The page has some independent value.',
        },
        {
          title: 'L5-Standalone Value',
          status: 'Good',
          description: 'The page performs well under current search algorithms.',
        },
      ],
    },
  },
  {
    label: 'Optimization Path',
    title: 'Optimization Path',
    type: 'optimizationPath',
    optimization: {
      primary_trust_blocker: {
        blocking_layer: 'Entity Presence (L0-A)',
        summary: 'The core reason for poor page performance is insufficient entity presence.',
        direct_consequences: [
          'Page lacks real-world identity traces.',
          'Reduced map verifiability.',
          'Page reads more like a keyword entry than a business entry.',
        ],
        why_cannot_skip:
          'Without first resolving entity presence, trust accumulation and optimization absorption will be significantly limited.',
      },
      must_execute_now: {
        items: [
          {
            title: '1. Strengthen Entity Presence',
            why_now: 'Entity presence is the foundation of page trust structure.',
            execution_focus: [
              'Add complete street address with LocalBusiness schema.',
              'Present consistent NAP information in footer.',
              'Add business hours module consistent with Google Business Profile.',
            ],
            completion_signals: [
              'Page contains complete address and business hours.',
              'Google can identify entity information through structured data.',
            ],
            expected_impact: [
              'Improved entity recognition.',
              'Enhanced local credibility and map verifiability.',
            ],
          },
          {
            title: '2. Strengthen Entity Presence',
            why_now: 'Entity presence is the foundation of page trust structure.',
            execution_focus: [
              'Add complete street address with LocalBusiness schema.',
              'Present consistent NAP information in footer.',
              'Add business hours module consistent with Google Business Profile.',
            ],
            completion_signals: [
              'Page contains complete address and business hours.',
              'Google can identify entity information through structured data.',
            ],
            expected_impact: [
              'Improved entity recognition.',
              'Enhanced local credibility and map verifiability.',
            ],
          },
          {
            title: '3. Strengthen Entity Presence',
            why_now: 'Entity presence is the foundation of page trust structure.',
            execution_focus: [
              'Add complete street address with LocalBusiness schema.',
              'Present consistent NAP information in footer.',
              'Add business hours module consistent with Google Business Profile.',
            ],
            completion_signals: [
              'Page contains complete address and business hours.',
              'Google can identify entity information through structured data.',
            ],
            expected_impact: [
              'Improved entity recognition.',
              'Enhanced local credibility and map verifiability.',
            ],
          },
        ],
      },
      roadmap: [
        {
          phase_title: 'Enhance Page Specificity',
          entry_condition: 'Entity presence and consistency are basically stable.',
          goal: 'Improve local scenario feel and service details.',
          key_actions: [
            'Add local climate or common local problem descriptions.',
            'Describe proximity to landmarks with real service cases.',
            'Specify service distance (mile/km) with real administrative areas.',
          ],
          expected_outcomes: [
            'Significantly enhanced local scenario feel.',
            'Page understood as more exclusive and locally relevant.',
          ],
        },
      ],
    },
  },
];

function ExecutiveSummaryPreview({ data }) {
  const metrics = [
    ['Current Status:', data.current_status],
    ['Ranking Potential:', data.ranking_potential],
    ['Risk Level:', data.risk_level],
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="rounded-[16px] border border-[#E6EDDA] bg-[#FBFDF5] px-4 py-3">
        <section className="text-[15px] font-black text-[#1A212B]">
          Primary Blocking Layer:{' '}
          <span className="text-[15px] font-black text-orange-700">{data.primary_blocking_layer}</span>
        </section>
      </div>

      <div className="rounded-[18px] border border-blue-100 bg-blue-50/50 p-5 shadow-[0_12px_30px_rgba(59,130,246,0.06)]">
        <p className="text-[15px] font-medium italic leading-relaxed text-gray-800">
          "{data.main_conclusion}"
        </p>
      </div>

      <ul className="space-y-3">
        {metrics.map(([label, value]) => (
          <li key={label} className="flex items-center gap-3">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: statusColors[value] || '#3B82F6' }}
            />
            <span className="text-[14px] font-medium text-gray-500">{label}</span>
            <span
              className="text-[14px] font-bold"
              style={{ color: statusColors[value] || '#3B82F6' }}
            >
              {value}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[14px] font-medium leading-relaxed text-gray-600">
        {data.explanation}
      </p>
    </div>
  );
}

function PageLevelPreview({ data }) {
  const cards = [
    { label: 'Observed Strength', value: data.existing_foundation },
    { label: 'Main Limitation', value: data.main_limitation },
    { label: 'Likely Search Outcome', value: data.likely_search_outcome },
    { label: 'Competitive Interpretation', value: data.competitive_interpretation },
  ];

  return (
    <div className="space-y-6 text-left">
      <section className="text-[15px] text-[#1A212B]">
        <span className="font-bold">current Assessment: </span>
        <span>{data.current_assessment}</span>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <div key={card.label} className="rounded-[14px] border border-gray-100 bg-gray-50 p-5">
            <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[#1A212B]">
              {card.label}
            </h4>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyIssuesPreview({ data }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-5 text-left">
      <section className="text-[15px] text-[#1A212B]">
        <span>{data.intro}</span>
      </section>

      <div className="rounded-[20px] border border-gray-200 bg-white p-5 md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A1F2B] text-[13px] font-bold text-white">
            1
          </span>
          <h3 className="text-[19px] font-bold text-[#1A1F2B]">
            Primary Trust Failure
          </h3>
        </div>
        <h4 className="mb-3 text-[15px] font-bold text-[#1A1F2B]">
          Current Blocking Layer: {data.primary_trust_failure.blocking_layer}
        </h4>
        <p className="max-w-2xl text-[15px] leading-relaxed text-[#374151]">
          {data.primary_trust_failure.summary}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[20px] border border-gray-200 bg-white p-5 md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A1F2B] text-[13px] font-bold text-white">
            2
          </span>
          <h3 className="text-[19px] font-bold text-[#1A1F2B]">
            Concrete Issues
          </h3>
        </div>

        <div
          className={`relative space-y-5 overflow-hidden transition-[max-height] duration-300 ease-out ${
            expanded ? 'max-h-[1200px]' : 'max-h-[185px]'
          }`}
        >
          {data.concrete_issues.map((issue) => (
            <div key={issue.title}>
              <h4 className="mb-3 text-[16px] font-bold text-[#1A1F2B]">
                {issue.title}
              </h4>
              <p className="mb-3 text-[14px] leading-relaxed text-[#374151]">
                {issue.body}
              </p>
              <p className="text-[14px] font-bold text-[#1A1F2B]">Impact:</p>
              <ul className="mb-3 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-[#374151]">
                {issue.impact.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="text-[14px] font-bold text-[#1A1F2B]">Recommended actions:</p>
              <ul className="list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-[#374151]">
                {issue.actions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/90 to-transparent" />
        )}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="relative z-10 mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-[13px] font-bold text-[#1A1F2B] shadow-sm transition hover:border-[#A5D020] hover:text-[#6FA500]"
        >
          {expanded ? 'Collapse' : 'Expand'}
          <span
            className={`text-[12px] transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          >
            v
          </span>
        </button>
      </div>
    </div>
  );
}

function SixLayerModelPreview({ data }) {
  const statusTagClass = {
    Good: 'bg-green-50 text-green-700',
    Fair: 'bg-yellow-50 text-yellow-700',
    Weak: 'bg-red-50 text-red-700',
  };

  return (
    <section className="text-left">
      <section className="mb-2 pb-2 text-[15px] text-[#1A212B]">
        <span>{data.intro}</span>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.layers.map((layer) => (
          <div key={layer.title} className="space-y-2 rounded-[14px] border border-gray-100 p-5">
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-[15px] font-bold text-[#1A212B]">{layer.title}</h4>
              <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${statusTagClass[layer.status] || 'bg-gray-50 text-gray-600'}`}>
                {layer.status}
              </span>
            </div>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">{layer.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BulletList({ items, color = 'bg-[#A5D020]' }) {
  if (!items?.length) return null;

  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-[14px] text-gray-600">
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function OptimizationStepCardPreview({ number, title, children }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-[#E4EDD2] bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
      <div className="mb-4 rounded-[14px] border border-[#E8F1D6] bg-[#F8FAF2] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#A5D020] text-[12px] font-black text-[#1A212B] shadow-sm">
            {number}
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8BAA2B]">Step {number}</p>
            <div className="mt-0.5 text-[14px] font-black leading-tight text-[#1A212B]">{title}</div>
          </div>
        </div>
      </div>

      <div className={`space-y-3 overflow-hidden pr-1 transition-all duration-300 ${expanded ? 'max-h-[1200px]' : 'max-h-[145px]'}`}>
        {children}
      </div>

      {!expanded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/95 to-white/0" />
      )}

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="relative z-10 mt-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[11px] font-bold text-[#1A212B] shadow-sm transition-all hover:border-[#A5D020] hover:bg-[#F8FAF5]"
      >
        {expanded ? 'Collapse' : 'Expand'}
        <span className={`text-[13px] transition-transform ${expanded ? 'rotate-180' : ''}`}>v</span>
      </button>
    </div>
  );
}

function OptimizationPathPreview({ data }) {
  const blocker = data.primary_trust_blocker;
  const mustItems = data.must_execute_now?.items || [];
  const roadmap = data.roadmap || [];

  return (
    <div className="grid grid-cols-1 gap-5 text-left">
      {blocker && (
        <OptimizationStepCardPreview number="1" title="Primary Trust Blocker">
          <p className="text-[16px] font-bold text-[#1A212B]">
            Current blocking layer: {blocker.blocking_layer}
          </p>
          <p className="text-[14px] leading-relaxed text-gray-600">{blocker.summary}</p>

          <div className="space-y-2">
            <p className="text-[13px] font-bold text-gray-500">As a result:</p>
            <BulletList items={blocker.direct_consequences} color="bg-red-400" />
          </div>

          <div className="space-y-1">
            <p className="text-[13px] font-bold text-gray-500">Why this layer cannot be skipped:</p>
            <p className="text-[14px] leading-relaxed text-gray-600">{blocker.why_cannot_skip}</p>
          </div>
        </OptimizationStepCardPreview>
      )}

      {mustItems.length > 0 && (
        <OptimizationStepCardPreview number="2" title="Must Execute Now">
          {mustItems.map((item, index) => (
            <div key={item.title} className="space-y-4">
              <h4 className="text-[16px] font-bold text-[#1A212B]">Must Fix {index + 1}- {item.title}</h4>

              <div className="space-y-1">
                <p className="text-[13px] font-bold text-gray-500">Why now:</p>
                <p className="text-[14px] leading-relaxed text-gray-600">{item.why_now}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[13px] font-bold text-gray-500">Execution focus:</p>
                <BulletList items={item.execution_focus} />
              </div>

              <div className="space-y-2">
                <p className="text-[13px] font-bold text-gray-500">Completion signals:</p>
                <BulletList items={item.completion_signals} />
              </div>

              <div className="space-y-2">
                <p className="text-[13px] font-bold text-gray-500">Expected impact:</p>
                <BulletList items={item.expected_impact} />
              </div>

              {index < mustItems.length - 1 && <div className="border-b border-gray-100" />}
            </div>
          ))}
        </OptimizationStepCardPreview>
      )}

      {roadmap.length > 0 && (
        <OptimizationStepCardPreview number="3" title="Roadmap">
          {roadmap.map((phase, index) => (
            <div key={phase.phase_title} className="space-y-4">
              <h4 className="text-[16px] font-bold text-[#1A212B]">Phase {index + 1}- {phase.phase_title}</h4>

              <div className="space-y-1">
                <p className="text-[13px] font-bold text-gray-500">Entry condition:</p>
                <p className="text-[14px] leading-relaxed text-gray-600">{phase.entry_condition}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[13px] font-bold text-gray-500">Goal:</p>
                <p className="text-[14px] leading-relaxed text-gray-600">{phase.goal}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[13px] font-bold text-gray-500">Key actions:</p>
                <BulletList items={phase.key_actions} />
              </div>

              <div className="space-y-2">
                <p className="text-[13px] font-bold text-gray-500">Expected outcomes:</p>
                <BulletList items={phase.expected_outcomes} />
              </div>
            </div>
          ))}
        </OptimizationStepCardPreview>
      )}
    </div>
  );
}

export function ReportPreview() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeTab = reportTabs[activeIndex];

  return (
    <section className="py-20 bg-[#F9FAFB]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-[36px] md:text-[42px] font-bold text-[#1A1F2B]">
            See what a Trust Collapse Report looks like
          </h2>
          <div className="section-title-bar" />
        </div>

        <div className="mx-auto max-w-6xl overflow-hidden rounded-[24px] border border-gray-100 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-5">
            {reportTabs.map((tab, index) => {
              const isActive = activeIndex === index;

              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`flex h-10 items-center justify-center rounded-xl border px-3 text-center text-[14px] font-semibold transition-all ${
                    isActive
                      ? 'border-[#1A1F2B] bg-[#1A1F2B] text-white shadow-sm'
                      : 'border-gray-100 bg-white text-[#173E64] hover:border-[#1A1F2B]/30 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 overflow-hidden rounded-[22px] border border-gray-100 bg-white">
            <div className="flex items-center gap-4 border-b border-gray-100 bg-[#FBFDF5] px-6 py-5 md:px-8">
              <span className="h-9 w-1.5 shrink-0 rounded-full bg-[#A5D020]" />
              <h3 className="text-[24px] font-black leading-tight tracking-tight text-[#1A212B] md:text-[28px]">
                {activeTab.title}
              </h3>
            </div>

            <div className="min-h-[360px] p-4 text-[#173E64] md:p-5">
              {activeTab.type === 'executiveSummary' ? (
                <ExecutiveSummaryPreview data={activeTab.summary} />
              ) : activeTab.type === 'pageLevel' ? (
                <PageLevelPreview data={activeTab.pageLevel} />
              ) : activeTab.type === 'keyIssues' ? (
                <KeyIssuesPreview data={activeTab.keyIssues} />
              ) : activeTab.type === 'sixLayerModel' ? (
                <SixLayerModelPreview data={activeTab.sixLayerModel} />
              ) : activeTab.type === 'optimizationPath' ? (
                <OptimizationPathPreview data={activeTab.optimization} />
              ) : (
                <>
                  <div className="mb-8 max-w-3xl">
                    <p className="text-[15px] font-semibold leading-relaxed">{activeTab.body}</p>
                  </div>

                  <div className="space-y-5">
                    {activeTab.items.map((item, index) => {
                      const title = typeof item === 'string' ? item : item.title;
                      const description = typeof item === 'string'
                        ? index === 0
                          ? 'This section identifies the strongest trust signal and the weakest break point for the submitted page.'
                          : 'The report keeps recommendations tied to specific trust evidence, so the next action is easier to explain.'
                        : item.description;

                      return (
                        <div key={title}>
                          <div className="flex gap-3">
                            <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-black text-[#173E64] ring-1 ring-[#BCD0E8]">
                              {index + 1}
                            </span>
                            <div>
                              <p className="text-[16px] font-black">{title}</p>
                              <p className="mt-2 max-w-4xl text-[14px] font-medium leading-relaxed text-[#315A7E]">
                                {description}
                              </p>
                            </div>
                          </div>
                          {index < activeTab.items.length - 1 && (
                            <div className="mt-5 h-2 rounded-full bg-[#C7DFF6]" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
