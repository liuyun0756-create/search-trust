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
    <section className={`bg-[#f7faf7] py-20 text-[#1d3127] ${className}`}>
      <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* 居中标题 */}
        <div className="text-center mb-12">
          <h2 className="text-[36px] font-semibold leading-[1.12] tracking-[-0.045em] text-[#1d3127] md:text-[46px]">
            {leadingTitle}
            {leadingTitle && ' '}
            <span className="text-[#477c60]">{accentWord}</span>
          </h2>
        </div>

        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-[#e0e9e0] bg-white px-5 py-2 sm:px-8">
          <div className="divide-y divide-[#e8eee8]">
            {items.map((faq, index) => (
              <div
                key={index}
                className="relative"
              >
                <button
                  onClick={() => setOpenIndex(index)}
                  aria-expanded={openIndex === index}
                  className="flex w-full items-center justify-between gap-4 py-6 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#477c60]"
                >
                  <span className="pr-4 text-[16px] font-semibold text-[#1d3127]">
                    {faq.question}
                  </span>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                    openIndex === index ? 'bg-[#eaf4ed] text-[#234b38]' : 'bg-[#f3f6f3] text-[#6a7c6d]'
                  }`}>
                    {openIndex === index ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                <div className={`overflow-hidden transition-all duration-500 ease-out ${
                  openIndex === index ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="min-h-[46px] pb-6 pr-9">
                    <p className="text-[14px] font-medium leading-[1.7] text-[#5d6f62]">
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
