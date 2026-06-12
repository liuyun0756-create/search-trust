"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Target, AlertTriangle, Layers, Wrench } from 'lucide-react';

export function AuditPreview() {
  const [activeTab, setActiveTab] = useState('summary');
  const [activeFixTab, setActiveFixTab] = useState('blocker');

  const pageLevelCards = [
    {
      title: 'Observed Strength',
      desc: 'The page already aligns with a service intent and includes some degree of local relevance, giving it a chance to enter local search competition.',
    },
    {
      title: 'Main Limitation',
      desc: 'The page still depends too much on general domain strength and does not yet establish itself as a strong independent local asset.',
    },
    {
      title: 'Likely Search Outcome',
      desc: 'Rankings may appear for certain local phrases, but performance can plateau or fluctuate under stronger market pressure.',
    },
    {
      title: 'Competitive Interpretation',
      desc: 'Against weaker competitors, this page may hold visibility. Against stronger pages with deeper trust signals, it can be overtaken.',
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
      title: 'Layer 1: Relevance',
      status: 'Moderate',
      desc: 'The page clearly targets a service theme, but semantic coverage is not deep enough to fully reinforce topical authority at the page level.',
    },
    {
      title: 'Layer 2: Entity Clarity',
      status: 'Weak-Moderate',
      desc: 'Business identity exists, but the page does not strongly express who the provider is, why it is legitimate, and how it connects to the local market.',
    },
    {
      title: 'Layer 3: Proof Signals',
      status: 'Weak',
      desc: 'Reviews, projects, testimonials, outcomes, and other trust-validating signals are too limited to create strong confidence.',
    },
    {
      title: 'Layer 4: Local Fit',
      status: 'Moderate',
      desc: 'The page includes local intent, but geographic fit is not reinforced strongly enough through local references, context, and service-area signals.',
    },
    {
      title: 'Layer 5: Structural Trust',
      status: 'Moderate',
      desc: 'Page structure is generally acceptable, but some content patterns appear too generic and do not build enough confidence through specificity.',
    },
    {
      title: 'Layer 6: Standalone Value',
      status: 'Weak-Moderate',
      desc: 'The page has basic utility, but does not yet deliver enough unique, independently valuable substance to justify strong trust on its own.',
    },
  ];

  const tabs = [
    { id: 'summary', label: 'Overall Summary', icon: <ShieldCheck size={16} /> },
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
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* 状态简报卡片 */}
            <div className="bg-[#F8F9FA] rounded-2xl p-6 border border-gray-100">
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-[14px] font-medium text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A5D020]" />
                  Current Status: Medium-Low / Medium / Good
                </li>
                <li className="flex items-center gap-3 text-[14px] font-medium text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A5D020]" />
                  Ranking Potential: Competitive / Room for Growth / Strong Competitiveness
                </li>
                <li className="flex items-center gap-3 text-[14px] font-medium text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A5D020]" />
                  Risk Level: Medium / Medium-High / Low
                </li>
              </ul>
            </div>

            {/* 核心结论文字 */}
            <div className="bg-[#F8F9FA] rounded-2xl p-6 border border-gray-100">
              <p className="text-[15px] leading-relaxed text-gray-700 font-medium">
                Your page meets the basic conditions to compete in local search, but it is not yet a high-trust local business page.
                It has basic service relevance and local targeting, but still has clear shortcomings in entity trust, real-world connections, and standalone page value.
              </p>
            </div>

            {/* 可能遇到的问题列表 */}
            <div className="bg-[#F8F9FA] rounded-2xl p-6 border border-gray-100">
              <h4 className="text-[14px] font-bold text-gray-900 mb-4">What you are more likely experiencing:</h4>
              <ul className="space-y-3">
                {['Page gets indexed, but rankings are unstable', 'Some keywords appear in results, but struggle to climb steadily', 'Heavily dependent on overall site authority', 'Easily outranked by competitors with stronger local signals'].map((text, i) => (
                  <li key={i} className="flex items-start gap-3 text-[14px] text-gray-500 leading-snug">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400" />
                    {text} 
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        );
      case 'level':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-gray-200 bg-white p-6 md:p-8"
          >
            <h3 className="text-[28px] md:text-[34px] font-bold text-[#1A1F2B] mb-6">
              Page Level
            </h3>

            <p className="text-[16px] md:text-[18px] leading-relaxed text-[#1A1F2B] mb-8">
              <span className="font-bold">Current Assessment:</span>{' '}
              This page sits above the basic participation threshold, but below the level typically associated with strong, trust-rich local landing pages
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pageLevelCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-[22px] border border-gray-200 bg-[#F8F9FA] p-6 md:p-7 shadow-[0_8px_24px_rgba(15,23,42,0.03)]"
                >
                  <h4 className="text-[18px] font-bold text-[#1A1F2B] mb-4">
                    {card.title}
                  </h4>
                  <p className="text-[15px] md:text-[16px] leading-relaxed text-[#374151] font-medium">
                    {card.desc}
                  </p>
                </div>
              ))}
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
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-7"
          >
            <div>
              <h3 className="text-[28px] md:text-[34px] font-bold text-[#1A1F2B] mb-5">
                Six-Layer Model
              </h3>
              <p className="text-[16px] md:text-[18px] leading-relaxed text-[#4B5563]">
                Below is the full six-layer trust diagnosis used to interpret the current strength of the page.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {layerCards.map((layer) => (
                <div
                  key={layer.title}
                  className="rounded-[24px] border border-gray-200 bg-white p-6 md:p-7"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <h4 className="text-[20px] font-bold text-[#1A1F2B] leading-snug">
                      {layer.title}
                    </h4>
                    <span className="shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-bold text-[#4B5563]">
                      {layer.status}
                    </span>
                  </div>
                  <p className="text-[16px] leading-relaxed text-[#4B5563] font-medium">
                    {layer.desc}
                  </p>
                </div>
              ))}
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

            <div className="rounded-[24px] border border-gray-200 bg-white p-6 md:p-8">
              <div className="mb-7 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A1F2B] text-[16px] font-bold text-white">
                  {activeOptimizationTab.label.split('.')[0]}
                </span>
                <h3 className="text-[22px] md:text-[26px] font-bold text-[#1A1F2B]">
                  {activeOptimizationTab.title}
                </h3>
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
        <h2 className="text-center text-[32px] md:text-[40px] font-bold text-[#1A1F2B] mb-12">
          See What a Local Trust Audit Looks Like
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 左侧：固定信息栏 */}
          <div className="lg:col-span-3 space-y-4">
            {[
              { label: 'URL', value: 'https://nxtlvlautospa.com/' },
              { label: 'Type', value: 'Local Service Page' },
              { label: 'GBP URL', value: 'https://nxtlvlautospa.com/' },
            ].map((info, i) => (
              <div key={i} className="bg-[#F3F4F6] rounded-xl p-5 border border-gray-100">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">{info.label}</p>
                <p className="text-[13px] font-bold text-gray-800 break-all">{info.value}</p>
              </div>
            ))}
          </div>

          {/* 右侧：交互标签页 */}
          <div className="lg:col-span-9">
            {/* Tab 导航 */}
            <div className="flex flex-wrap gap-2 mb-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold transition-all ${
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
      </div>
    </section>
  );
}
