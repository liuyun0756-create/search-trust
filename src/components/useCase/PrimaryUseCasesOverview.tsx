"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCheck,
  ArrowRight,
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
    shortLabel: 'Audit local pages\nbefore publishing',
    description:
      'You\'re about to publish a city page, service-area page, or location landing page — but you don\'t know whether it looks like a credible local destination or just another scalable template.',
    currentPractice: [
      'Manually review copy',
      'Check keywords and meta data',
      'Check whether city name / FAQ / map are present',
      'Guess by experience whether it is "too templated"',
    ],
    whyNotEnoughIntro:
      'These checks can only verify whether the page was completed, but cannot explain:',
    whyNotEnough: [
      'Whether the page represents a real entity',
      'Whether it has real-world anchors',
      'Whether it deserves to exist independently',
    ],
    howHelps: [
      'Analyze the page\'s dominant failure layer',
      'Determine whether the page is only location-labeled',
      'Find gaps in specificity, real-world anchors, and standalone value',
      'Give low-cost fix recommendations before launch',
    ],
    outputs: ['Trust status', 'Dominant layer', 'Risk list', 'Fix priorities'],
    benefits: [
      'Reduce low-trust pages before launch',
      'Lower late-stage rework',
      'Raise the publishing quality threshold',
    ],
  },
  {
    id: 'client-reporting',
    icon: BarChart3,
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
      'Does Google see this page as a real local entry point?',
      'Where has the page lost trust?',
      'Is the page structurally unstable?',
    ],
    howHelps: [
      'Detect the trust fracture layer',
      'Explain how Google may interpret the page',
      'Distinguish "not enough content" from "the structure is not trusted"',
      'Give the repair action that should happen first',
    ],
    outputs: [],
    benefits: [
      'Reduce ineffective trial and error',
      'Identify the core issue faster',
      'Help teams stop the habit of "keep adding content and see"',
    ],
  },
  {
    id: 'ai-review',
    icon: Bot,
    label: 'Review AI-generated city pages at scale',
    shortLabel: 'Review AI-generated\ncity pages at scale',
    description:
      'You can now generate dozens or hundreds of city pages quickly — but speed does not tell you which pages look believable and which look like doorway-style expansion.',
    currentPractice: [
      'Only check grammar and duplication',
      'Manually sample-review pages',
      'Judge whether the page "reads okay"',
      'Check keyword coverage',
    ],
    whyNotEnoughIntro:
      'These practices cannot structurally judge:',
    whyNotEnough: [
      'Whether the page is overly templated',
      'Whether city-replacement traces are too strong',
      'Whether real-world anchors are missing',
      'Whether the page lacks independent value',
    ],
    howHelps: [
      'Find programmatic risk signals',
      'Identify generic local page patterns',
      'Locate the most common trust gaps',
      'Build a basic trust QA layer for scaled content',
    ],
    outputs: [],
    benefits: [
      'Reduce batch page risk',
      'Raise the floor for template production',
      'Create a trust-review standard for content factories',
    ],
  },
  {
    id: 'multi-location',
    icon: MapPinCheckInside,
    label: 'Improve client reporting for agencies',
    shortLabel: 'Improve client reporting\nfor agencies',
    description:
      'You know a local page is underperforming because it feels weak, templated, or unconvincing — but it is hard to explain that in a client-friendly way.',
    currentPractice: [
      'Say "the content is not local enough"',
      'Say "we need stronger E-E-A-T"',
      'Say "page quality is average"',
      'Give many vague recommendations',
    ],
    whyNotEnoughIntro:
      'Clients still ask:',
    whyNotEnough: [
      'Where exactly is the gap?',
      'Why can other pages rank?',
      'Which part should be fixed first?',
    ],
    howHelps: [
      'Explain the issue with layer-based diagnosis',
      'Provide a more structured and visual report',
      'Help explain why this page looks like a template page',
      'Give repair actions with clearer priority',
    ],
    outputs: [],
    benefits: [
      'Improve client communication quality',
      'Strengthen agency professionalism',
      'Reduce vague explanations like "the content is not enough"',
    ],
  },
  {
    id: 'doorway-risk',
    icon: ShieldAlert,
    label: 'Validate multi-location page quality',
    shortLabel: 'Validate multi-location\npage quality',
    description:
      'You know a local page is underperforming because it feels weak, templated, or unconvincing — but it is hard to explain that in a client-friendly way.',
    currentPractice: [
      'Content similarity is high',
      'Only the place name changes',
      'Page value is not independent',
      'Local binding is weak',
    ],
    whyNotEnoughIntro:
      'When multiple location pages exist at the same time, common problems include:',
    whyNotEnough: [
      'Content similarity is high',
      'Only the place name changes',
      'Page value is not independent',
      'Local binding is weak',
    ],
    howHelps: [
      'Determine whether different location pages are truly differentiated',
      'Find pages that are only renamed as local pages',
      'Help establish quality standards for location pages',
    ],
    outputs: [],
    benefits: [
      'Improve location page consistency',
      'Reduce batch location page risk',
      'Help brands unify local page standards',
    ],
  },
  {
    id: 'stuck-pages',
    icon: SearchX,
    label: 'Reduce doorway and programmatic page risk',
    shortLabel: 'Reduce doorway\nprogrammatic risk',
    description:
      'After page scale expands, many problems are no longer about whether the content is good, but whether the whole system looks like a set of low-value expansion pages.',
    currentPractice: [],
    whyNotEnoughIntro: '',
    whyNotEnough: [],
    howHelps: [
      'Detect templated traces',
      'Analyze whether standalone value is insufficient',
      'Find city-replacement structures',
      'Help teams establish pre-publish red-line standards',
    ],
    outputs: [],
    benefits: [],
  },
];

export function PrimaryUseCasesOverview() {
  const [activeTab, setActiveTab] = useState(0);
  const current = tabs[activeTab];
  const hasAudienceModule = current.id === 'ai-review' || current.id === 'stuck-pages';
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
    : current.id === 'stuck-pages'
      ? {
          title: 'Best for',
          items: ['affiliate teams', 'mass-page operators', 'agencies doing scale local SEO', 'internal growth teams'],
        }
      : null;
  const audienceOnLeft = current.id === 'stuck-pages';
  const hasRightColumn = hasWhyNotEnough || current.outputs.length > 0 || audienceOnLeft;
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
        'Does Google see this page as a real local entry point?',
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
    <div className="rounded-[22px] border border-[#A5D020]/25 bg-white p-6">
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
             Six ways teams use SearchTrust
          </p>
        </div>

        {/* Tab buttons */}
        <div className="grid grid-cols-1 gap-3 mb-12 sm:grid-cols-2 lg:grid-cols-6">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(index)}
              className={`flex h-[64px] w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-[11px] font-bold transition-all ${
                activeTab === index
                  ? 'bg-[#1A1F2B] text-white shadow-lg'
                  : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-gray-200'
              }`}
            >
              <tab.icon size={16} className="shrink-0" />
              <span className="whitespace-pre-line leading-tight">{tab.shortLabel}</span>
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
            className="bg-[#F9FAFB] rounded-[32px] p-8 md:p-12"
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
                <div className={`grid grid-cols-1 gap-7 ${hasRightColumn ? 'lg:grid-cols-2' : ''}`}>
                  <div className="space-y-7">
                    {hasCurrentPractice && (
                      <div className="rounded-[22px] border border-gray-100 bg-white p-6">
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

                    {audienceOnLeft && audienceCard}

                    {!audienceOnLeft && (
                    <div className="rounded-[22px] border border-[#A5D020]/25 bg-white p-6">
                      <h4 className="mb-4 text-[18px] font-bold text-[#1A1F2B]">
                        How SearchTrust helps
                      </h4>
                      <ul className="list-disc space-y-2 pl-5 text-[16px] font-medium leading-relaxed text-[#1A1F2B]">
                        {current.howHelps.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    )}
                  </div>

                  {hasRightColumn && (
                  <div className="space-y-7">
                    {audienceOnLeft && (
                      <div className="rounded-[22px] border border-[#A5D020]/25 bg-white p-6">
                        <h4 className="mb-4 text-[18px] font-bold text-[#1A1F2B]">
                          How SearchTrust helps
                        </h4>
                        <ul className="list-disc space-y-2 pl-5 text-[16px] font-medium leading-relaxed text-[#1A1F2B]">
                          {current.howHelps.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {hasWhyNotEnough && (
                      <div className="rounded-[22px] border border-gray-100 bg-white p-6">
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

                    {current.outputs.length > 0 && (
                      <div className="rounded-[22px] border border-gray-100 bg-white p-6">
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

                    {!audienceOnLeft && audienceCard}
                  </div>
                  )}
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
