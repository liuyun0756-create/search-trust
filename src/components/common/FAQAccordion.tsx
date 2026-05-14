"use client";

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  tag?: string;
  title?: string;
  items: FAQItem[];
  className?: string;
}

export function FAQAccordion({
  tag = 'FAQ',
  title = 'Frequently asked questions',
  items,
  className = '',
}: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className={`py-20 bg-[#F7F9FA] ${className}`}>
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* 居中标题 */}
        <div className="text-center mb-8">
          <div className="inline-block px-4 py-1.5 rounded-full bg-[#F4F7E9] text-[#A5D020] text-[12px] font-bold mb-4">
            {tag}
          </div>
          <h2 className="text-[36px] md:text-[42px] font-bold text-[#1A1F2B]">
            {title}
          </h2>
        </div>

        {/* 白色卡片容器 + 手风琴列表 */}
        <div className="max-w-3xl mx-auto rounded-[24px] ">
          <div className="space-y-3">
            {items.map((faq, index) => (
              <div
                key={index}
                className={`border rounded-[16px] overflow-hidden transition-all duration-300 ${openIndex === index ? 'bg-white border-gray-200' : 'border-gray-100'}`}
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
