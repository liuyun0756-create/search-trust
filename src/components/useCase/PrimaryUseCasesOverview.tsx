"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCheck,
  ArrowRight,
  BarChart3,
  Bot,
  SearchX,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
} from 'lucide-react';

const tabs = [
  {
    id: 'multi-location',
    icon: BarChart3,
    label: 'Prepare a client audit and proposal',
    shortLabel: 'Client audit\nand proposal',
    description:
      'Turn one priority local page into a defensible scope of work: diagnose the problem internally, then explain the priority and recommended work in a client-ready format.',
    currentPractice: [
      'Describe the page as "not local enough"',
      'Send a flat issue list with no implementation order',
      'Mix technical evidence and client-facing explanation',
      'Scope work from judgement without a reusable audit structure',
    ],
    whyNotEnoughIntro:
      'Clients and account teams still need to understand:',
    whyNotEnough: [
      'What is confirmed rather than assumed',
      'Which trust layer should be addressed first',
      'What work is being approved and what comes later',
    ],
    howHelps: [
      'Use the Full Audit for evidence, layer diagnosis, and implementation detail',
      'Turn confirmed findings into proposal-ready actions',
      'Preview exactly what the client will see',
      'Export a simplified Client PDF or the Full Audit PDF',
    ],
    outputs: ['Full Agency Audit', 'Client Report Preview', 'Client PDF', 'Full Audit PDF'],
    benefits: [
      'More defensible proposal scope',
      'Clearer client approval conversations',
      'Less manual report rewriting',
    ],
  },
  {
    id: 'client-reporting',
    icon: SearchX,
    label: 'Diagnose indexed-but-stuck pages',
    shortLabel: 'Diagnose indexed-\nbut-stuck pages',
    description:
      'The page is indexed, technically fine, and maybe even has some links — but it still does not gain meaningful rankings or local visibility.',
    currentPractice: [
      'Check keyword rankings',
      'Check Search Console',
      'Add more content',
      'Change the title and H1',
      'Wait longer',
    ],
    whyNotEnoughIntro:
      'These actions do not answer:',
    whyNotEnough: [
      'Does the page show enough evidence to act as a real local entry point?',
      'Where has the page lost trust?',
      'Is the page structurally unstable?',
    ],
    howHelps: [
      'Identify the earliest affected L1-L8 layer',
      'Show the evidence behind confirmed findings',
      'Distinguish content volume from trust-structure problems',
      'Give the implementation phase that should happen first',
    ],
    outputs: [],
    benefits: [
      'Reduce ineffective trial and error',
      'Identify the core issue faster',
      'Help teams stop the habit of "keep adding content and see"',
    ],
  },
  {
    id: 'pre-publish',
    icon: FileCheck,
    label: 'Audit local pages before publishing',
    shortLabel: 'Pre-publish\npage audit',
    description:
      'Review a publicly accessible local service, city, service-area, or location page before it becomes the template for a wider rollout.',
    currentPractice: [
      'Check copy, keywords, metadata, FAQs, and maps',
      'Confirm that required sections are present',
      'Judge by experience whether the page feels too generic',
      'Publish first and repair trust gaps later',
    ],
    whyNotEnoughIntro:
      'Completion checks do not show:',
    whyNotEnough: [
      'Which trust signals are actually missing',
      'Whether the page is locally specific and independently useful',
      'What should be fixed before the page becomes a template',
    ],
    howHelps: [
      'Assess the complete fixed L1-L8 model',
      'Trace findings back to the checked source evidence',
      'Turn confirmed gaps into executable actions',
      'Set a clearer publishing quality gate',
    ],
    outputs: [],
    benefits: [
      'Reduce late-stage rework',
      'Catch weak pages before rollout',
      'Create a repeatable page approval standard',
    ],
  },
  {
    id: 'doorway-risk',
    icon: ListChecks,
    label: 'Manage staged remediation and re-audit',
    shortLabel: 'Staged remediation\nand re-audit',
    description:
      'Move from a long list of findings to an ordered work plan with clear completion gates, observation guidance, and a reason to re-audit.',
    currentPractice: [
      'Fix whichever item is easiest',
      'Change several layers at once',
      'Measure success immediately after publishing',
      'Lose track of what was completed and what remains',
    ],
    whyNotEnoughIntro:
      'Without a staged sequence:',
    whyNotEnough: [
      'Later improvements can be applied before earlier trust layers are stable',
      'Teams cannot tell whether a phase is complete',
      'The next audit has no clean implementation baseline',
    ],
    howHelps: [
      'Highlight the active phase in the four-stage roadmap',
      'Show completion requirements before advancing',
      'Explain the observation period after implementation',
      'Support a cleaner re-audit decision',
    ],
    outputs: [],
    benefits: [
      'More disciplined implementation',
      'Clearer handoff between teams',
      'A repeatable remediation cycle',
    ],
  },
  {
    id: 'ai-review',
    icon: Bot,
    label: 'Sample priority AI or multi-location pages',
    shortLabel: 'Priority-page\nsampling',
    description:
      'Use one-page audits to test high-value, underperforming, or representative pages before applying a pattern across a larger local content set.',
    currentPractice: [
      'Rely on grammar, duplication, and keyword checks',
      'Assume one template performs the same in every location',
      'Review too many pages without a priority sample',
      'Scale before confirming local specificity and standalone value',
    ],
    whyNotEnoughIntro:
      'Surface checks cannot confirm:',
    whyNotEnough: [
      'Whether the sample page is only location-labeled',
      'Whether it has real-world anchors and accountable detail',
      'Whether it deserves to exist as a separate local asset',
    ],
    howHelps: [
      'Audit one representative or priority URL at a time',
      'Expose reusable-template and weak-grounding signals',
      'Turn the sample findings into a stronger page standard',
      'Use re-audits to verify the revised pattern',
    ],
    outputs: [],
    benefits: [
      'A more efficient sampling strategy',
      'Lower rollout risk',
      'A clearer standard for future pages',
    ],
  },
];

export function PrimaryUseCasesOverview() {
  const [activeTab, setActiveTab] = useState(0);
  const current = tabs[activeTab];
  const hasAudienceModule = current.id === 'ai-review';
  const hasExpandedUseCase =
    'whyNotEnough' in current &&
    'benefits' in current &&
    (Boolean(current.whyNotEnough?.length) || hasAudienceModule || current.currentPractice.length > 0);
  const whyNotEnough = 'whyNotEnough' in current ? current.whyNotEnough ?? [] : [];
  const benefits = 'benefits' in current ? current.benefits ?? [] : [];
  const hasCurrentPractice = current.currentPractice.length > 0;
  const hasWhyNotEnough = whyNotEnough.length > 0 || Boolean('whyNotEnoughIntro' in current && current.whyNotEnoughIntro);
  const hasBenefits = benefits.length > 0;
  const audienceModule = current.id === 'ai-review'
    ? {
        title: 'Best for',
        items: ['Affiliate marketers', 'SEO agencies', 'Scaled content teams', 'Lead-gen operators'],
      }
    : null;
  const localizedWhyModules: Record<string, { title: string; intro: string; items: string[] }> = {
    'pre-publish': {
      title: 'Why this is not enough',
      intro: 'These checks only confirm that the page was completed, but they cannot explain:',
      items: ['Whether the page is truly specific', 'Whether it has real-world anchors', 'Whether it deserves to exist on its own'],
    },
    'client-reporting': {
      title: 'Why this is not enough',
      intro: 'These actions do not answer:',
      items: [
        'Does the checked evidence support this page as a real local entry point?',
        'Where did the page lose trust?',
        'Is the structure itself unstable?',
      ],
    },
  };
  const localizedWhyModule = localizedWhyModules[current.id];
  const whyModuleTitle = localizedWhyModule?.title || 'Why this is not enough';
  const whyModuleIntro = localizedWhyModule?.intro || ('whyNotEnoughIntro' in current ? current.whyNotEnoughIntro : '');
  const whyModuleItems = localizedWhyModule?.items || whyNotEnough;
  const audienceCard = audienceModule ? (
    <div className="h-full rounded-[22px] border border-[#A5D020]/25 bg-white p-6">
      <h4 className="mb-4 text-[18px] font-bold text-[#1A1F2B]">
        {audienceModule.title}
      </h4>
      <ul className="list-disc space-y-2 pl-5 text-[16px] font-medium leading-relaxed text-[#1A1F2B]">
        {audienceModule.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  ) : null;

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          {/* <div className="inline-block px-3 py-1 rounded-full bg-[#F4F7E9] text-[#A5D020] text-[12px] font-bold mb-6">
            
          </div> */}
          {/* <h2 className="text-[36px] md:text-[44px] font-bold text-[#1A1F2B] leading-[1.2]">
            Six ways teams use SearchTrust
          </h2> */}

          <h2 className="text-[36px] md:text-[44px] font-bold text-[#1A1F2B] mb-6 leading-[1.2]">
           Primary Use Cases Overview
          </h2>
          <p className="text-[16px] md:text-[18px] text-[#6B7280] leading-[1.2]">
             Five focused ways teams use SearchTrust
          </p>
        </div>

        {/* Tab buttons */}
        <div className="grid grid-cols-1 gap-3 mb-12 sm:grid-cols-2 lg:grid-cols-5">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(index)}
              className={`grid h-[72px] w-full grid-cols-[32px_minmax(0,1fr)] items-center gap-3 rounded-xl px-4 py-3 text-left text-[11px] font-bold transition-all ${
                activeTab === index
                  ? 'bg-[#1A1F2B] text-white shadow-lg'
                  : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-gray-200'
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  activeTab === index
                    ? 'bg-white/10 text-[#B7DC43]'
                    : 'bg-white text-[#697386]'
                }`}
                aria-hidden="true"
              >
                <tab.icon size={16} strokeWidth={1.9} />
              </span>
              <span className="flex min-h-8 items-center whitespace-pre-line leading-[1.25]">
                {tab.shortLabel}
              </span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.id}-use-case-with-right-context`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="rounded-[32px] border border-[#E9EEE2] bg-white p-8 shadow-[0_20px_60px_rgba(26,31,43,0.05)] md:p-12"
            style={{
              backgroundImage: "url('/images/abstract-lines.jpg')",
              backgroundPosition: 'center top',
              backgroundRepeat: 'no-repeat',
              backgroundSize: 'cover',
            }}
          >
            {/* Title and description */}
            <div className="mb-10">
              <h3 className="text-[24px] md:text-[28px] font-bold text-[#1A1F2B] mb-4">
                {current.label}
              </h3>
              <p className="text-[16px] text-[#6B7280] leading-relaxed max-w-[1100px] font-medium">
                {current.description}
              </p>
            </div>

            {hasExpandedUseCase ? (
              <>
                <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 lg:auto-rows-fr">
                  {hasCurrentPractice && (
                    <div className="h-full rounded-[22px] border border-gray-100 bg-white p-6">
                      <h4 className="mb-4 text-[18px] font-bold text-[#1A1F2B]">
                        Current common practice
                      </h4>
                      <ul className="list-disc space-y-2 pl-5 text-[16px] font-medium leading-relaxed text-[#1A1F2B]">
                        {current.currentPractice.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {hasWhyNotEnough && (
                    <div className="h-full rounded-[22px] border border-gray-100 bg-white p-6">
                      <h4 className="mb-3 text-[18px] font-bold text-[#1A1F2B]">
                        {whyModuleTitle}
                      </h4>
                      {whyModuleIntro && (
                        <p className="mb-3 text-[16px] font-medium leading-relaxed text-[#1A1F2B]">
                          {whyModuleIntro}
                        </p>
                      )}
                      <ul className="list-disc space-y-2 pl-5 text-[16px] font-medium leading-relaxed text-[#1A1F2B]">
                        {whyModuleItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="h-full rounded-[22px] border border-[#A5D020]/25 bg-white p-6">
                      <h4 className="mb-4 text-[18px] font-bold text-[#1A1F2B]">
                        How SearchTrust helps
                      </h4>
                      <ul className="list-disc space-y-2 pl-5 text-[16px] font-medium leading-relaxed text-[#1A1F2B]">
                        {current.howHelps.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                  </div>

                  {current.outputs.length > 0 && (
                    <div className="h-full rounded-[22px] border border-gray-100 bg-white p-6">
                      <h4 className="mb-4 text-[18px] font-bold text-[#1A1F2B]">
                        Output
                      </h4>
                      <ul className="list-disc space-y-2 pl-5 text-[16px] font-medium leading-relaxed text-[#1A1F2B]">
                        {current.outputs.map((output) => (
                          <li key={output}>{output}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {audienceCard}
                </div>

                {hasBenefits && (
                <div className="mt-9">
                  <h4 className="mb-4 text-[18px] font-bold text-[#1A1F2B]">
                    Expected benefits
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {benefits.map((benefit) => (
                      <span
                        key={benefit}
                        className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#A5D020]/25 bg-white px-5 text-[14px] font-bold text-[#1A1F2B]"
                      >
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>
                )}

                <div className="mt-10 flex flex-wrap justify-end gap-4">
                  <a
                    href="/pricing"
                    className="inline-flex min-w-[220px] items-center justify-center rounded-xl bg-[#1A1F2B] px-8 py-4 text-[15px] font-bold text-white transition-colors hover:bg-black"
                  >
                    Run a Trust Audit
                  </a>
                  <a
                    href="/sample-case"
                    target="_blank"
                    className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-8 py-4 text-[15px] font-bold text-[#4B5563] transition-colors hover:border-gray-400 hover:text-[#1A1F2B]"
                  >
                    View Sample Report
                    <ArrowRight size={16} />
                  </a>
                </div>
              </>
            ) : (
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
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
