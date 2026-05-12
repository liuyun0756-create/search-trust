"use client";

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqData = [
  {
    question: "What does SearchTrust analyze?",
    answer: "SearchTrust analyzes one submitted local page URL and evaluates it through a six-layer trust model to identify where structural trust breaks down and what to fix first.",
  },
  {
    question: "What kinds of pages is it best for?",
    answer: "SearchTrust is best for local service pages, city pages, service-area pages, and location landing pages. It is built for local page trust diagnosis, not general-purpose site auditing.",
  },
  {
    question: "Is this a full SEO audit?",
    answer: "No. SearchTrust is not a full technical SEO audit, rank tracker, or GBP management tool. It focuses on page-level trust qualification, structural credibility, and local competitiveness.",
  },
  {
    question: "What do I receive after purchase?",
    answer: "You receive one structured report for one submitted URL. The report includes current trust status, dominant failure layer, findings across the six-layer model, and prioritized recommendations.",
  },
  {
    question: "How is the report delivered?",
    answer: "After payment, you submit the URL you want reviewed. Your report is delivered by email within two hours.",
  },
  {
    question: "Is the report automated?",
    answer: "SearchTrust generates the report through an automated analysis workflow based on the submitted page and the SearchTrust framework.",
  },
  {
    question: "Can I use this before publishing a page?",
    answer: "Yes. Pre-publish review is one of the clearest use cases for SearchTrust. It can help identify weak local grounding, template risk, and trust gaps before rollout.",
  },
  {
    question: "Does this guarantee better rankings?",
    answer: "No. SearchTrust does not guarantee rankings, traffic, or business outcomes. It helps diagnose structural trust weaknesses that may affect a page's ability to compete in local search.",
  },
  {
    question: "Is this suitable for agencies?",
    answer: "Yes. Agencies can use SearchTrust for pre-publish reviews, stuck-page diagnosis, and clearer client reporting around page-level trust weaknesses.",
  },
  {
    question: "Can I get a refund?",
    answer: "Refunds may be available before processing begins. Once report processing has started or the report has been delivered, purchases are generally non-refundable. Please see our Refund Policy for full details.",
  },
];

export function SampleReportFAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">

          {/* 左侧标题 */}
          <div className="lg:col-span-4">
            <div className="inline-block px-3 py-1 rounded-full bg-[#F4F7E9] text-[#A5D020] text-[12px] font-bold mb-6">
              FAQ
            </div>
            <h2 className="text-[40px] md:text-[48px] font-bold text-[#1A1F2B] leading-tight mb-8">
              Frequently asked<br />questions
            </h2>
          </div>

          {/* 右侧手风琴 */}
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
                  <span className="text-[17px] font-bold text-[#1A1F2B] pr-4">
                    {faq.question}
                  </span>
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    openIndex === index ? 'bg-[#A5D020] text-white' : 'bg-white border border-gray-200 text-gray-400'
                  }`}>
                    {openIndex === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
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
