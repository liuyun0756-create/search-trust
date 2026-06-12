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
  title = 'Frequently asked questions',
  items,
  className = '',
}: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState(0);
  const titleWords = title.replace(/\n/g, ' ').split(' ');
  const accentWord = titleWords.pop();
  const leadingTitle = titleWords.join(' ');

  return (
    <section className={`relative overflow-hidden py-24 bg-[#F7F9FA] ${className}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,249,250,0))] pointer-events-none" />
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">

        {/* 居中标题 */}
        <div className="text-center mb-12">
          <h2 className="text-[36px] md:text-[46px] font-bold text-[#1A1F2B] leading-[1.12] tracking-tight">
            {leadingTitle}
            {leadingTitle && ' '}
            <span className="text-bar-highlight">{accentWord}</span>
          </h2>
          <div className="mx-auto mt-6 flex w-full max-w-[520px] items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-200" />
            <div className="h-2 w-24 rounded-full bg-[#A5D020]" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-200" />
          </div>
        </div>

        {/* 白色卡片容器 + 手风琴列表 */}
        <div className="max-w-3xl mx-auto rounded-[24px] bg-white/70 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.06)] ring-1 ring-gray-100 backdrop-blur-sm">
          <div className="space-y-3">
            {items.map((faq, index) => (
              <div
                key={index}
                className={`relative border rounded-[18px] overflow-hidden transition-all duration-300 ${
                  openIndex === index
                    ? 'bg-white border-gray-200 shadow-[0_10px_30px_rgba(15,23,42,0.05)]'
                    : 'bg-white/75 border-gray-100 hover:bg-white'
                }`}
              >
                <div className={`absolute left-0 top-0 h-full w-1 bg-[#A5D020] transition-opacity duration-300 ${
                  openIndex === index ? 'opacity-100' : 'opacity-0'
                }`} />
                <button
                  onClick={() => setOpenIndex(index)}
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

                <div className={`overflow-hidden transition-all duration-500 ease-out ${
                  openIndex === index ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="min-h-[46px] px-6 pb-6">
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
