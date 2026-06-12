"use client";

import React, { useState } from 'react';

const reportTabs = [
  {
    label: 'Executive Summary',
    title: 'Executive Summary',
    items: [
      'Current Status: Medium-Low / Medium / Good',
      'Ranking Potential: Competitive / Room for Growth',
      'Risk Level: Medium / Medium-High / Low',
    ],
    body: 'Your page meets the basic conditions to compete in local search, but it is not yet a high-trust local business page.',
  },
  {
    label: 'Page Level',
    title: 'Page Level',
    items: [
      'URL: https://nxtlvlautospa.com/',
      'Page Type: Local Service Page',
      'GBP URL: https://nxtlvlautospa.com/',
    ],
    body: 'The page is reviewed as a city / location-intent landing page with trust signals mapped to the SearchTrust framework.',
  },
  {
    label: 'Key Issues',
    title: 'Key Issues',
    items: [
      'Entity signals are not consistently consolidated',
      'Local proof is present but weakly grounded',
      'Standalone page value is not yet clear enough',
    ],
    body: 'Issues are grouped by the trust layer they weaken, so the report shows what to fix first instead of listing isolated SEO notes.',
  },
  {
    label: 'Six-Layer Model',
    title: 'Six-Layer Model',
    items: [
      'L0 Relevance',
      'L1 Entity Clarity',
      'L2 Proof Signals',
      'L3 Local Fit',
      'L4 Structural Trust',
      'L5 Standalone Value',
    ],
    body: 'Each layer explains how Google may interpret the page, where trust breaks, and which weakness creates the highest downstream cost.',
  },
  {
    label: 'Optimization Path',
    title: 'Optimization Path',
    items: [
      'Primary Trust Blocker: Entity consistency layer',
      'Must Fix 1: Align entity identity across all surfaces',
      'Must Fix 2: Make the page feel like a real local service instance',
      'Roadmap: Strengthen real-world connection and standalone value',
    ],
    body: 'The optimization path prioritizes the lowest-cost recovery sequence instead of recommending more content by default.',
  },
];

export function ReportPreview() {
  const [activeIndex, setActiveIndex] = useState(4);
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

        <div className="mx-auto max-w-6xl overflow-hidden rounded-[26px] border border-[#C8D7EA] bg-[#E8F3FF] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {reportTabs.map((tab, index) => {
              const isActive = activeIndex === index;

              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`flex h-12 items-center justify-center rounded-xl border px-3 text-center text-[15px] font-semibold transition-all ${
                    isActive
                      ? 'border-[#173E64] bg-[#173E64] text-white shadow-sm'
                      : 'border-[#BCD0E8] bg-[#DCEEFF] text-[#173E64] hover:border-[#173E64]/30 hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-[#BCD0E8] bg-[#D6EAFE]">
            <div className="border-b border-[#BCD0E8] px-5 py-3">
              <h3 className="text-[18px] font-bold text-[#173E64]">{activeTab.title}</h3>
            </div>

            <div className="min-h-[470px] p-5 text-[#173E64] md:p-7">
              <div className="mb-8 max-w-3xl">
                <p className="text-[15px] font-semibold leading-relaxed">{activeTab.body}</p>
              </div>

              <div className="space-y-5">
                {activeTab.items.map((item, index) => (
                  <div key={item}>
                    <div className="flex gap-3">
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-black text-[#173E64] ring-1 ring-[#BCD0E8]">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-[16px] font-black">{item}</p>
                        <p className="mt-2 max-w-4xl text-[14px] font-medium leading-relaxed text-[#315A7E]">
                          {index === 0
                            ? 'This section identifies the strongest trust signal and the weakest break point for the submitted page.'
                            : 'The report keeps recommendations tied to specific trust evidence, so the next action is easier to explain.'}
                        </p>
                      </div>
                    </div>
                    {index < activeTab.items.length - 1 && (
                      <div className="mt-5 h-2 rounded-full bg-[#C7DFF6]" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
