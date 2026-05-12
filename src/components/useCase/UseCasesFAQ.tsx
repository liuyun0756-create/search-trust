"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

const faqData = [
  {
    question: 'Which use case is best for agencies?',
    answer:
      'Agency reporting + pre-publish review + stuck page diagnosis. These three use cases cover the most common agency needs: validating pages before they go live, diagnosing why existing pages underperform, and communicating findings to clients in a structured way.',
  },
  {
    question: 'Can I use SearchTrust before publishing pages?',
    answer:
      'Yes, that is one of the clearest MVP use cases. Run a trust audit on any URL — including staging or preview URLs — to catch structural trust issues before they reach search engines.',
  },
  {
    question: 'Is it useful for AI-generated local pages?',
    answer:
      'Yes. It helps identify whether pages look generic, templated, or weakly grounded. AI-generated pages often pass surface-level checks but fail trust signals at deeper layers.',
  },
  {
    question: 'Does it replace rank tracking tools?',
    answer:
      'No. It complements them by diagnosing trust-related structural failure. Rank tracking tells you what happened; SearchTrust explains why it happened from a trust perspective.',
  },
  {
    question: 'Is this only for local SEO?',
    answer:
      'The MVP is primarily built for local pages and local trust diagnosis. The L0–L5 framework is designed specifically for pages that need to establish entity authority in local search contexts.',
  },
  {
    question: 'Can multi-location brands use it?',
    answer:
      'Yes, especially for reviewing page differentiation and local grounding. Multi-location brands can audit across all location pages to ensure consistency and standalone value.',
  },
];

export function UseCasesFAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-4">
            <div className="inline-block px-3 py-1 rounded-full bg-[#F4F7E9] text-[#A5D020] text-[12px] font-bold mb-6">
              FAQ
            </div>
            <h2 className="text-[40px] md:text-[48px] font-bold text-[#1A1F2B] leading-tight mb-8">
              Frequently asked<br />questions
            </h2>
            <a
              href="#"
              className="inline-flex items-center gap-2 text-[#A5D020] font-bold hover:underline"
            >
              Contact us <ArrowRight size={18} />
            </a>
          </div>

          <div className="lg:col-span-8 space-y-3">
            {faqData.map((faq, index) => (
              <div
                key={index}
                className="border border-gray-100 rounded-[18px] overflow-hidden transition-all duration-300"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
                  className="w-full flex items-center justify-between p-7 text-left hover:bg-gray-50/50 transition-colors"
                >
                  <span className="text-[17px] font-bold text-[#1A1F2B]">
                    {faq.question}
                  </span>
                  <div
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      openIndex === index
                        ? 'bg-[#A5D020] text-white'
                        : 'bg-white border border-gray-200 text-gray-400'
                    }`}
                  >
                    {openIndex === index ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </div>
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    openIndex === index
                      ? 'max-h-[300px] opacity-100'
                      : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-7 pb-8">
                    <p className="text-[15px] leading-relaxed text-gray-500 font-medium max-w-2xl">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
