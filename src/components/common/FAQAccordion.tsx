"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  tag?: string;
  title?: string;
  items: FAQItem[];
  showContactLink?: boolean;
  contactLabel?: string;
  contactHref?: string;
  className?: string;
}

export function FAQAccordion({
  tag = 'FAQ',
  title = 'Frequently asked\nquestions',
  items,
  showContactLink = false,
  contactLabel = 'Contact us',
  contactHref = '#',
  className = '',
}: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className={`py-24 bg-white ${className}`}>
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-4">
            <div className="inline-block px-3 py-1 rounded-full bg-[#F4F7E9] text-[#A5D020] text-[12px] font-bold mb-6">
              {tag}
            </div>
            <h2 className="text-[40px] md:text-[48px] font-bold text-[#1A1F2B] leading-tight mb-8">
              {title.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  {line}
                </React.Fragment>
              ))}
            </h2>
            {showContactLink && (
              <a
                href={contactHref}
                className="inline-flex items-center gap-2 text-[#A5D020] font-bold hover:underline"
              >
                {contactLabel} <ArrowRight size={18} />
              </a>
            )}
          </div>

          <div className="lg:col-span-8 space-y-3">
            {items.map((faq, index) => (
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
                  <div
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      openIndex === index
                        ? 'bg-[#A5D020] text-white'
                        : 'bg-white border border-gray-200 text-gray-400'
                    }`}
                  >
                    {openIndex === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    openIndex === index ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
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
