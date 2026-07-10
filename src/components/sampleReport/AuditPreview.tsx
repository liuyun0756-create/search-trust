"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Target, AlertTriangle, Layers, Wrench } from 'lucide-react';

export function AuditPreview() {
  const [activeTab, setActiveTab] = useState('summary');
  const [activeFixTab, setActiveFixTab] = useState('blocker');

  const statusColors: Record<string, string> = {
    'Medium-Low': '#B45309',
    'Low potential': '#A5D020',
    'Medium-High risk': '#EF4444',
  };

  const executiveSummary = {
    primary_blocking_layer: 'Entity Presence (L0-A)',
    current_status: 'Medium-Low',
    ranking_potential: 'Low potential',
    risk_level: 'Medium-High risk',
    main_conclusion:
      'Your page qualifies for local search competition, but is not yet a high-trust local business page.',
    explanation:
      'The page has foundational capabilities, such as a clear topic and service direction, but shows visible gaps in entity presence and specificity. These gaps cause the page to be interpreted as lacking real-world identity traces, limiting trust accumulation and ranking stability in local search.',
  };

  const pageLevelCards = [
    {
      title: 'Observed Strength',
      desc: 'The page has built basic capabilities such as clear topic direction and good algorithm adaptation.',
    },
    {
      title: 'Main Limitation',
      desc: 'The page has not yet established strong entity presence or real-world anchors.',
    },
    {
      title: 'Likely Search Outcome',
      desc: 'In low-competition environments, the page may gain some ranking opportunities, but in high-competition settings, it will struggle against pages with higher trust.',
    },
    {
      title: 'Competitive Interpretation',
      desc: 'Against stronger competitors, the trust gap will be amplified, especially in queries requiring entity verification and specific scenario support.',
    },
  ];

  const concreteIssues = [
    {
      title: '1 - Entity presence is not strong enough',
      body: 'The page explains what you do, but it does not clearly confirm who is responsible for the service. It contains service information, but business identity signals are still not expressed consistently enough.',
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
      body: 'The page mentions the local area, but it does not yet feel like the service actually happens there. If real scenarios, local context, and service delivery details are missing, the page can feel generic or template-based.',
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
      body: 'The page describes services, but does not sufficiently show process, boundaries, limitations, applicable situations, or next steps.',
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
      body: 'The page exists, but it has not fully proven why it deserves to exist on its own. If it is too similar to other location pages, Google may interpret it as coverage for more keywords rather than a page built for a distinct local need.',
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
  ];

  const layerCards = [
    {
      title: 'L0-Relevance',
      status: 'Good',
      desc: 'The page has clear topic direction and service positioning.',
    },
    {
      title: 'L1-Entity Clarity',
      status: 'Fair',
      desc: 'Page content is too generic, lacking local context language.',
    },
    {
      title: 'L2-Proof Signals',
      status: 'Fair',
      desc: 'The page has weak connection to geographic space.',
    },
    {
      title: 'L3-Local Fit',
      status: 'Weak',
      desc: 'The page focuses more on meeting search demand than taking real-world responsibility.',
    },
    {
      title: 'L4-Strutural Trust',
      status: 'Good',
      desc: 'The page has some independent value.',
    },
    {
      title: 'L5-Standalone Value',
      status: 'Good',
      desc: 'The page performs well under current search algorithms.',
    },
  ];

  const tabs = [
    { id: 'summary', label: 'Executive Summary', icon: <ShieldCheck size={16} /> },
    { id: 'level', label: 'Page Level', icon: <Target size={16} /> },
    { id: 'issues', label: 'Key Issues', icon: <AlertTriangle size={16} /> },
    { id: 'layers', label: 'Six-Layer Model', icon: <Layers size={16} /> },
    { id: 'fixes', label: 'Optimization Path', icon: <Wrench size={16} /> },
  ];

  const optimizationTabs = [
    { id: 'blocker', label: '1. Primary Trust Blocker', title: 'Primary Trust Blocker' },
    { id: 'execute', label: '2. Must Execute Now', title: 'Must Execute Now' },
    { id: 'roadmap', label: '3. Roadmap', title: 'Roadmap' },
    { id: 'order', label: '4. If Fix Order Is Wrong', title: 'If Fix Order Is Wrong' },
    { id: 'forecast', label: '5. Next 30 Days', title: "What You'll Likely See in the Next 30 Days" },
  ];

  const activeOptimizationTab = optimizationTabs.find((tab) => tab.id === activeFixTab) || optimizationTabs[0];

  const BulletList = ({ items }: { items: string[] }) => (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h4 className="mt-8 mb-3 text-[16px] font-bold text-[#1A1F2B] first:mt-0">
      {children}
    </h4>
  );

  const renderExecutiveSummary = () => {
    const metrics = [
      ['Current Status:', executiveSummary.current_status],
      ['Ranking Potential:', executiveSummary.ranking_potential],
      ['Risk Level:', executiveSummary.risk_level],
    ];

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8 rounded-[24px] border border-gray-100 bg-white p-6 md:p-8"
      >
        <div className="rounded-[18px] border border-[#E6EDDA] bg-[#FBFDF5] px-5 py-4">
          <section className="text-[15px] font-black text-[#1A212B]">
            Primary Blocking Layer:{' '}
            <span className="text-[15px] font-black text-orange-700">
              {executiveSummary.primary_blocking_layer}
            </span>
          </section>
        </div>

        <div className="rounded-[22px] border border-blue-100 bg-blue-50/50 p-8 shadow-[0_12px_30px_rgba(59,130,246,0.06)]">
          <p className="text-[17px] font-medium italic leading-relaxed text-gray-800">
            "{executiveSummary.main_conclusion}"
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

        <p className="text-[15px] font-medium leading-relaxed text-gray-600">
          {executiveSummary.explanation}
        </p>
      </motion.div>
    );
  };

  const renderOptimizationContent = () => {
    const contentClass = "text-[15px] leading-relaxed text-[#1A1F2B]";

    switch (activeFixTab) {
      case 'blocker':
        return (
          <div className={contentClass}>
            <h4 className="mb-5 text-[18px] font-bold text-[#1A1F2B]">
              Current Blocking Layer: Entity Consistency Layer (L0-B)
            </h4>
            <p className="max-w-3xl">
              This is the earliest trust break point for this page. Google can understand what you offer, but cannot consistently confirm that all signals refer to the same business entity.
            </p>

            <SectionTitle>As a result:</SectionTitle>
            <BulletList
              items={[
                'Entity signals cannot be reliably consolidated',
                'Your page cannot form a stable local identity',
                'Rankings may appear, but will not sustain against stronger competitors',
              ]}
            />

            <SectionTitle>Why this layer cannot be skipped:</SectionTitle>
            <p>
              Before evaluating content quality or local relevance, Google must first confirm: "Is this one stable, real-world business entity?"
            </p>

            <SectionTitle>If entity consistency is unstable:</SectionTitle>
            <BulletList
              items={[
                'Content improvements will not accumulate trust',
                'Local signals remain fragmented',
                'GBP and page signals cannot fully connect',
              ]}
            />
            <p className="mt-2">This makes all downstream optimization less effective.</p>
          </div>
        );
      case 'execute':
        return (
          <div className={contentClass}>
            <h4 className="mb-6 text-[17px] font-bold text-[#1A1F2B]">
              Must Fix 1 - Align Entity Identity Across All Surfaces
            </h4>

            <SectionTitle>Why now:</SectionTitle>
            <p>Your business identity is currently expressed inconsistently across pages and signals.</p>

            <SectionTitle>This weakens the connection between:</SectionTitle>
            <BulletList items={['This page', 'Your homepage / contact page', 'Your GBP listing']} />

            <SectionTitle>Execution focus:</SectionTitle>
            <BulletList
              items={[
                'Standardize business name (exact format)',
                'Align phone number, address, and service area',
                'Ensure consistency across: Homepage, Contact page, About page, Footer, and GBP profile',
              ]}
            />

            <SectionTitle>Completion signals:</SectionTitle>
            <BulletList
              items={[
                'All pages present the same business identity without variation',
                'No conflicting versions of name / contact / service scope',
              ]}
            />

            <SectionTitle>Expected impact:</SectionTitle>
            <BulletList
              items={[
                'Stronger entity binding',
                'More stable local signal consolidation',
                'Higher trust absorption for future optimizations',
              ]}
            />

            <div className="my-8 border-t border-gray-200" />

            <h4 className="mb-6 text-[17px] font-bold text-[#1A1F2B]">
              Must Fix 2 - Make the Page Feel Like a Real Local Service Instance
            </h4>

            <SectionTitle>Why now:</SectionTitle>
            <p>
              Even with consistent entity signals, a templated or generic page cannot be recognized as a real-world service node.
            </p>

            <SectionTitle>Execution focus:</SectionTitle>
            <BulletList
              items={[
                'Add real local service scenarios',
                'Include customer context and use cases',
                'Introduce location-specific language and situations',
                'Improve CTA to reflect real interaction (not generic conversion text)',
              ]}
            />

            <SectionTitle>Completion signals:</SectionTitle>
            <BulletList
              items={[
                'Page cannot be easily replicated to another city',
                'Clear evidence of real service happening in this location',
              ]}
            />

            <SectionTitle>Expected impact:</SectionTitle>
            <BulletList
              items={[
                'Reduced "templated page" perception',
                'Stronger local relevance signals',
                'Improved trust at the specificity layer (L1)',
              ]}
            />
          </div>
        );
      case 'roadmap':
        return (
          <div className={contentClass}>
            <h4 className="mb-6 text-[17px] font-bold text-[#1A1F2B]">
              Phase 2 - Strengthen Real-World Connection & Service Accountability
            </h4>

            <SectionTitle>Entry condition:</SectionTitle>
            <p>Entity consistency and page specificity are stabilized.</p>

            <SectionTitle>Goal:</SectionTitle>
            <BulletList
              items={[
                'Anchor the page in real-world geography',
                'Improve service credibility and responsibility signals',
              ]}
            />

            <SectionTitle>Key actions:</SectionTitle>
            <BulletList
              items={[
                'Add neighborhood / landmark / service radius references',
                'Describe how the service actually happens locally',
                'Add service process (what happens after contact)',
                'Include limitations, edge cases, and expectations',
              ]}
            />

            <SectionTitle>Expected outcomes:</SectionTitle>
            <BulletList
              items={[
                'Page becomes a real-world service node, not a search landing page',
                'Local signals become more verifiable',
                'Trust increases at L2 (Real-world connection) and L3 (Accountability)',
              ]}
            />

            <div className="my-8 border-t border-gray-200" />

            <h4 className="mb-6 text-[17px] font-bold text-[#1A1F2B]">
              Phase 3 - Strengthen Standalone Value & Long-Term Trust
            </h4>

            <SectionTitle>Entry condition:</SectionTitle>
            <p>Real-world connection and service structure are in place.</p>

            <SectionTitle>Goal:</SectionTitle>
            <BulletList
              items={[
                'Justify why this page should exist independently',
                'Strengthen long-term algorithm trust signals',
              ]}
            />

            <SectionTitle>Key actions:</SectionTitle>
            <BulletList
              items={[
                'Add unique FAQ specific to this location/service',
                'Differentiate clearly from other city/service pages',
                'Align reviews with: Service, Location, and Entity',
              ]}
            />

            <SectionTitle>Expected outcomes:</SectionTitle>
            <BulletList
              items={[
                'Stronger standalone ranking capability',
                'Reduced internal competition between similar pages',
                'Better resilience across core updates and local recalculations',
              ]}
            />
          </div>
        );
      case 'order':
        return (
          <div className={contentClass}>
            <p>If later-stage optimizations are applied before fixing the primary blocker:</p>
            <p className="mt-5">Trust is evaluated sequentially.</p>

            <SectionTitle>If earlier layers fail:</SectionTitle>
            <BulletList
              items={[
                'Later improvements cannot fully contribute',
                'Optimization effort has low absorption',
              ]}
            />

            <SectionTitle>For this page:</SectionTitle>
            <p>The primary trust break occurs at: Entity Consistency (L0-B)</p>

            <SectionTitle>This means:</SectionTitle>
            <BulletList
              items={[
                'Google cannot reliably connect this page to a single business entity',
                'Local signals remain fragmented across pages and GBP',
                'Ranking performance will remain unstable',
              ]}
            />

            <p className="mt-8 max-w-3xl font-medium">
              For this page, the biggest risk is not "doing too little", but "fixing the wrong layer first."
            </p>
          </div>
        );
      case 'forecast':
        return (
          <div className={contentClass}>
            <p>
              This pattern is typical when the primary trust break occurs at: Entity Consistency (L0-B)
            </p>
            <p className="mt-2">
              If the primary trust blocker is not fixed first, you will likely observe the following patterns over the next 30 days:
            </p>

            <SectionTitle>Week 1-2:</SectionTitle>
            <BulletList
              items={[
                'Minor ranking improvements may appear after content updates',
                'Some keywords may temporarily move up',
                'Overall visibility still feels inconsistent',
              ]}
            />

            <SectionTitle>Week 2-3:</SectionTitle>
            <BulletList
              items={[
                'Ranking gains begin to plateau or fluctuate',
                'Pages with stronger local trust signals start to outrank you',
                'New content additions show limited impact',
              ]}
            />

            <SectionTitle>Week 3-4:</SectionTitle>
            <BulletList
              items={[
                'Rankings become unstable across similar queries',
                'Some keywords drop back despite continued optimization',
                'Performance becomes harder to predict or scale',
              ]}
            />

            <SectionTitle>By the end of 30 days:</SectionTitle>
            <BulletList
              items={[
                'The page may look more complete, but not more trusted',
                'Effort invested does not translate into sustained ranking gains',
                'Further optimization requires increasing effort for diminishing returns',
              ]}
            />

            <p className="mt-8">This pattern is typical when early trust layers remain unresolved.</p>
          </div>
        );
      default:
        return null;
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'summary':
        return renderExecutiveSummary();
      case 'level':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.05)]"
          >
            <div className="p-7 md:p-10">
              <p className="mb-8 text-[16px] font-medium leading-relaxed text-[#1A212B] md:text-[18px]">
                <span className="font-black">current Assessment: </span>
                The page has some local search competition foundation, but trust structure is thin,
                especially in entity feel and specificity.
              </p>

              <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
                {pageLevelCards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-[22px] border border-gray-200 bg-[#F8F9FA] p-7 shadow-[0_8px_24px_rgba(15,23,42,0.03)] md:p-9"
                  >
                    <h4 className="mb-5 text-[18px] font-black uppercase tracking-[0.08em] text-black">
                      {card.title}
                    </h4>
                    <p className="text-[20px] font-medium leading-relaxed text-[#4B5563] md:text-[22px]">
                      {card.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        );
      case 'issues':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <div className="rounded-[24px] border border-gray-200 bg-white p-6 md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1F2B] text-[15px] font-bold text-white">
                  1
                </span>
                <h3 className="text-[22px] font-bold text-[#1A1F2B]">
                  Primary Trust Failure
                </h3>
              </div>
              <h4 className="mb-4 text-[17px] font-bold text-[#1A1F2B]">
                Current Blocking Layer: Entity Consistency Layer (L0-B)
              </h4>
              <p className="max-w-2xl text-[15px] leading-relaxed text-[#374151]">
                Google can understand what you offer, but cannot consistently confirm who you are. As a result, trust signals cannot accumulate properly.
              </p>
            </div>

            <div className="rounded-[24px] border border-gray-200 bg-white p-6 md:p-8">
              <div className="mb-7 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1F2B] text-[15px] font-bold text-white">
                  2
                </span>
                <h3 className="text-[22px] font-bold text-[#1A1F2B]">
                  Concrete Issues
                </h3>
              </div>

              <div className="space-y-8">
                {concreteIssues.map((issue) => (
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
            </div>
          </motion.div>
        );
      case 'layers':
        const statusTagClass: Record<string, string> = {
          Good: 'bg-green-50 text-green-700',
          Fair: 'bg-yellow-50 text-yellow-700',
          Weak: 'bg-red-50 text-red-700',
        };

        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.05)]"
          >
            <div className="p-7 md:p-10">
              <p className="mb-8 text-[20px] font-medium leading-relaxed text-[#1A212B] md:text-[24px]">
                Below is the full six-layer trust diagnosis used to interpret the current strength of the page.
              </p>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {layerCards.map((layer) => (
                  <div
                    key={layer.title}
                    className="rounded-[18px] border border-gray-100 bg-white p-6"
                  >
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <h4 className="text-[20px] font-black leading-snug text-[#1A212B]">
                        {layer.title}
                      </h4>
                      <span className={`shrink-0 rounded-full px-4 py-2 text-[15px] font-black ${statusTagClass[layer.status] || 'bg-gray-50 text-gray-600'}`}>
                        {layer.status}
                      </span>
                    </div>
                    <p className="text-[16px] font-medium leading-relaxed text-[#4B5563]">
                      {layer.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        );
      case 'fixes':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <div className="flex flex-wrap gap-2 rounded-[18px] border border-gray-100 bg-[#F8F9FA] p-2">
              {optimizationTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFixTab(tab.id)}
                  className={`rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all ${
                    activeFixTab === tab.id
                      ? 'bg-[#2D2E32] text-white shadow-sm'
                      : 'bg-white text-gray-500 hover:text-[#1A1F2B]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="rounded-[24px] border border-[#DCEBBC] bg-white p-4 md:p-6">
              <div className="mb-7 rounded-[20px] border border-[#E2EFC8] bg-[#FBFDF5] px-5 py-5 shadow-[0_8px_22px_rgba(15,23,42,0.04)] md:px-7">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#A5D020] text-[22px] font-black text-[#1A212B] shadow-[0_8px_16px_rgba(165,208,32,0.24)]">
                    {activeOptimizationTab.label.split('.')[0]}
                  </span>
                  <div>
                    <p className="mb-0.5 text-[13px] font-black uppercase tracking-[0.24em] text-[#8BAA2B]">
                      STEP {activeOptimizationTab.label.split('.')[0]}
                    </p>
                    <h3 className="text-[22px] font-black leading-tight text-[#1A212B] md:text-[26px]">
                      {activeOptimizationTab.title}
                    </h3>
                  </div>
                </div>
              </div>
              {renderOptimizationContent()}
            </div>
          </motion.div>
        );
      default:
        return <div className="p-12 text-center text-gray-400">Content for {activeTab} is loading...</div>;
    }
  };

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto max-w-6xl px-6">
        <h2 className="text-center text-[32px] md:text-[40px] font-bold text-[#1A1F2B] mb-8">
          See What a Local Trust Audit Looks Like
        </h2>

        <div className="mb-8 grid grid-cols-1 gap-3 rounded-[22px] border border-gray-100 bg-gray-50/70 p-3 md:grid-cols-3">
          {[
            { label: 'URL', value: 'https://nxtlvlautospa.com/' },
            { label: 'Page type', value: 'Local Service Page' },
            { label: 'GBP URL', value: 'https://nxtlvlautospa.com/' },
          ].map((info) => (
            <div key={info.label} className="rounded-2xl bg-white px-5 py-4">
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{info.label}</p>
              <p className="break-all text-[13px] font-bold text-[#1A1F2B]">{info.value}</p>
            </div>
          ))}
        </div>

        <div>
            {/* Tab 导航 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center justify-center gap-2 px-4 py-3 rounded-xl text-[14px] font-bold transition-all ${
                    activeTab === tab.id 
                    ? 'bg-[#2D2E32] text-white shadow-lg shadow-gray-200' 
                    : 'bg-white border border-gray-100 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 内容显示区 */}
            <div className="min-h-[400px]">
              <AnimatePresence mode="wait">
                {renderContent()}
              </AnimatePresence>
            </div>
        </div>
      </div>
    </section>
  );
}
