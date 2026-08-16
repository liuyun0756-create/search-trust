"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqData = [
  {
    question: "How is SearchTrust different from a standard SEO audit tool?",
    answer: "Standard SEO tools measure performance signals: backlinks, traffic, content length, and technical errors. SearchTrust diagnoses page and entity trust structure: what evidence is present, which trust layer is weak, and what to fix first."
  },
  {
    question: "What is the SearchTrust 8-layer trust model?",
    answer: "It is a structured local trust diagnosis model covering foundation, entity presence, entity consistency, specificity, real-world connection, accountability, page unique value, and algorithm fit."
  },
  {
    question: "Does SearchTrust work for any type of local page?",
    answer: "Yes, it is designed for service area businesses, multi-location brands, and local lead-gen pages that need to establish entity authority."
  },
  {
    question: "Is this a replacement for my existing SEO tools?",
    answer: "No, it's a diagnostic layer that sits on top of tools like Ahrefs or Semrush to explain the 'why' behind ranking plateaus that those tools can't detect."
  },
  {
    question: "How long does a trust audit take?",
    answer: "A single-page audit usually generates a web report shortly after processing. Delivery timing may vary by page availability, data coverage, and workflow load."
  },
  {
    question: "Can I run trust audits in bulk?",
    answer: "The current checkout analyzes one URL at a time. Agencies and multi-location teams can start with priority pages first; broader batch workflows are not part of the current $19 one-time report."
  }
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="py-20 bg-[#F7F9FA]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* 居中标题 */}
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-1.5 rounded-full bg-[#F4F7E9] text-[#A5D020] text-[12px] font-bold mb-4">
            FAQ
          </div>
          <h2 className="text-[36px] md:text-[42px] font-bold text-[#1A1F2B]">
            Frequently asked questions
          </h2>
        </div>

        {/* 白色卡片容器 + 手风琴列表 */}
        <div className="max-w-3xl mx-auto bg-white rounded-[24px] p-8 md:p-10">
          <div className="space-y-3">
            {faqData.map((faq, index) => (
              <div
                key={index}
                className="border border-gray-100 rounded-[16px] overflow-hidden transition-all duration-300"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50/50 transition-colors"
                >
                  <span className="text-[16px] font-bold text-[#1A1F2B] pr-4">
                    {faq.question}
                  </span>
                  <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    openIndex === index ? 'bg-[#A5D020] text-white' : 'bg-white border border-gray-200 text-gray-400'
                  }`}>
                    {openIndex === index ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* 展开内容 */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="px-6 pb-6">
                    <p className="text-[14px] leading-relaxed text-gray-500 font-medium">
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
