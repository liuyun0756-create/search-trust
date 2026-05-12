"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

const faqData = [
  {
    question: "How is SearchTrust different from a standard SEO audit tool?",
    answer: "Standard SEO tools measure performance signals: backlinks, traffic, content length, technical errors. SearchTrust diagnoses trust signals — specifically why Google might withhold trust from a page even when standard signals look correct. It's a different instrument for a different question."
  },
  {
    question: "What is the L0–L5 Trust Collapse Model?",
    answer: "The L0-L5 model is a structural framework designed to diagnose whether a page qualifies as a real local entity entry point, covering layers from basic qualification to modern era-fit."
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
    answer: "A single-page audit is processed in real-time, typically providing a full Trust Collapse Report in under 60 seconds."
  },
  {
    question: "Can I run trust audits in bulk?",
    answer: "Bulk auditing is available for enterprise teams managing hundreds or thousands of location pages simultaneously."
  }
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          {/* 左侧标题区域 */}
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

          {/* 右侧手风琴列表 */}
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
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    openIndex === index ? 'bg-[#A5D020] text-white' : 'bg-white border border-gray-200 text-gray-400'
                  }`}>
                    {openIndex === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>
                
                {/* 展开的内容 */}
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