"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCheck,
  BarChart3,
  Bot,
  MapPinCheckInside,
  ShieldAlert,
  SearchX,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
} from 'lucide-react';

const tabs = [
  {
    id: 'pre-publish',
    icon: FileCheck,
    label: 'Audit local pages before publishing',
    shortLabel: 'Pre-publish review',
    description:
      'You\'re about to publish a city page, service-area page, or location landing page — but you don\'t know whether it looks like a credible local destination or just another scalable template.',
    currentPractice: [
      'Manually review copy for quality',
      'Check keywords and meta tags',
      'Verify city name, FAQ, and map presence',
      'Guess whether it feels "too templated"',
    ],
    howHelps: [
      'Analyze which trust layer dominates the page',
      'Determine if the page is just location-labeled',
      'Identify lack of specificity, real anchors, and standalone value',
      'Provide low-cost fix suggestions before publishing',
    ],
    outputs: ['Trust status', 'Dominant layer', 'Risk list', 'Fix priorities'],
  },
  {
    id: 'client-reporting',
    icon: BarChart3,
    label: 'Improve client reporting for agencies',
    shortLabel: 'Client reporting',
    description:
      'Your client asks why their local pages aren\'t ranking. You have traffic data and keyword positions — but no structural explanation for why Google might not trust those pages.',
    currentPractice: [
      'Show keyword ranking changes',
      'Report on traffic and impressions',
      'List technical issues found by crawlers',
      'Provide generic content improvement tips',
    ],
    howHelps: [
      'Layer-based diagnosis that explains the "why"',
      'Structured reports clients can actually understand',
      'Clear prioritization of what matters most',
      'Evidence-based recommendations, not opinions',
    ],
    outputs: ['Layer breakdown', 'Trust score', 'Priority fixes', 'Client-ready report'],
  },
  {
    id: 'ai-review',
    icon: Bot,
    label: 'Review AI-generated city pages at scale',
    shortLabel: 'AI page review',
    description:
      'You\'re using AI to generate hundreds of local pages. They read well individually — but structurally, they might share the same weaknesses across every location.',
    currentPractice: [
      'Spot-check a few samples manually',
      'Run grammar and readability tools',
      'Check for duplicate content',
      'Hope the AI got the local details right',
    ],
    howHelps: [
      'Detect programmatic risk signals at scale',
      'Identify template patterns that Google may flag',
      'Run trust QA on every generated page',
      'Ensure each page has genuine local grounding',
    ],
    outputs: ['Template risk score', 'Pattern detection', 'Trust QA pass/fail', 'Batch fix list'],
  },
  {
    id: 'multi-location',
    icon: MapPinCheckInside,
    label: 'Validate multi-location page quality',
    shortLabel: 'Multi-location QA',
    description:
      'You manage pages for dozens or hundreds of locations. Ensuring consistency and differentiation across all of them is nearly impossible without structural analysis.',
    currentPractice: [
      'Manually compare a few location pages',
      'Check that NAP data is consistent',
      'Verify each page has unique content',
      'Rely on local managers to flag issues',
    ],
    howHelps: [
      'Location page consistency analysis',
      'Differentiation scoring between pages',
      'Quality standards enforcement at scale',
      'Local entity alignment verification',
    ],
    outputs: ['Consistency report', 'Differentiation score', 'Quality benchmark', 'Location comparison'],
  },
  {
    id: 'doorway-risk',
    icon: ShieldAlert,
    label: 'Reduce doorway and programmatic page risk',
    shortLabel: 'Doorway risk',
    description:
      'Your site has dozens of city + service combinations. Some may qualify as doorway pages — similar content swapped with city names. Google has been cracking down on these patterns.',
    currentPractice: [
      'Manually review page similarity',
      'Try to add "unique" sections to each page',
      'Hope Google doesn\'t apply a doorway penalty',
      'Remove pages reactively after traffic drops',
    ],
    howHelps: [
      'Detect template-swap patterns automatically',
      'Measure standalone value for each page',
      'Identify city-replacement patterns that trigger penalties',
      'Provide proactive risk reduction strategies',
    ],
    outputs: ['Doorway risk score', 'Template detection', 'Standalone value', 'Risk reduction plan'],
  },
  {
    id: 'stuck-pages',
    icon: SearchX,
    label: 'Diagnose indexed-but-stuck pages',
    shortLabel: 'Stuck pages',
    description:
      'Your pages are indexed and optimized — but they\'re not gaining traction. Rankings are flat, impressions don\'t convert to clicks, and you can\'t explain why.',
    currentPractice: [
      'Check search console for technical issues',
      'Add more content or internal links',
      'Build more backlinks',
      'Wait and hope rankings improve',
    ],
    howHelps: [
      'Submit URL for structural trust analysis',
      'Map the page against the L0–L5 framework',
      'Identify which trust layer is collapsing',
      'Get prioritized output for what to fix first',
    ],
    outputs: ['Trust diagnosis', 'Layer mapping', 'Collapse reason', 'Fix priority'],
  },
];

export function PrimaryUseCasesOverview() {
  const [activeTab, setActiveTab] = useState(0);
  const current = tabs[activeTab];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-block px-3 py-1 rounded-full bg-[#F4F7E9] text-[#A5D020] text-[12px] font-bold mb-6">
            Primary Use Cases Overview
          </div>
          <h2 className="text-[36px] md:text-[44px] font-bold text-[#1A1F2B] leading-[1.2]">
            Six ways teams use SearchTrust
          </h2>
        </div>

        {/* Tab buttons */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(index)}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold transition-all ${
                activeTab === index
                  ? 'bg-[#1A1F2B] text-white shadow-lg'
                  : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-gray-200'
              }`}
            >
              <tab.icon size={16} />
              <span className="hidden sm:inline">{tab.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="bg-[#F9FAFB] rounded-[32px] p-8 md:p-12"
          >
            {/* Title and description */}
            <div className="mb-10">
              <h3 className="text-[24px] md:text-[28px] font-bold text-[#1A1F2B] mb-4">
                {current.label}
              </h3>
              <p className="text-[16px] text-[#6B7280] leading-relaxed max-w-3xl font-medium">
                {current.description}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left: Current vs How it helps */}
              <div className="lg:col-span-8 space-y-6">
                {/* Current practice */}
                <div className="bg-white rounded-[20px] p-6 border border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle size={16} className="text-orange-400" />
                    <h4 className="text-[14px] font-black text-[#1A1F2B] uppercase tracking-tight">
                      Current common practice
                    </h4>
                  </div>
                  <ul className="space-y-3">
                    {current.currentPractice.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                        </div>
                        <span className="text-[15px] text-[#6B7280] font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* How SearchTrust helps */}
                <div className="bg-white rounded-[20px] p-6 border border-[#A5D020]/20">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 size={16} className="text-[#A5D020]" />
                    <h4 className="text-[14px] font-black text-[#1A1F2B] uppercase tracking-tight">
                      How SearchTrust helps
                    </h4>
                  </div>
                  <ul className="space-y-3">
                    {current.howHelps.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle2 size={18} className="text-[#A5D020] shrink-0 mt-0.5" />
                        <span className="text-[15px] text-[#1A1F2B] font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right: Outputs */}
              <div className="lg:col-span-4">
                <div className="bg-[#1A1F2B] rounded-[20px] p-6 text-white h-full">
                  <div className="flex items-center gap-2 mb-6">
                    <ListChecks size={16} className="text-[#A5D020]" />
                    <h4 className="text-[14px] font-black uppercase tracking-tight">
                      Output
                    </h4>
                  </div>
                  <div className="space-y-4">
                    {current.outputs.map((output, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
                      >
                        <div className="w-2 h-2 rounded-full bg-[#A5D020]" />
                        <span className="text-[15px] font-bold text-white/90">{output}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
