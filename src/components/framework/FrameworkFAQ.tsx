"use client";

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqData = [
  {
    question: "Why eight layers?",
    answer:
      "Because local page trust is not built by one signal. The v2.1 framework separates foundation, entity presence, entity consistency, specificity, real-world connection, accountability, page unique value, and algorithm fit so the report can show where trust actually breaks.",
  },
  {
    question: "Are all layers equally important?",
    answer:
      "No. The layers are not equally important, and they often depend on each other. Earlier layers usually support later ones.",
  },
  {
    question: "Is this only for local pages?",
    answer:
      "Yes. It may still rank in the short term, but the structure is usually less stable.",
  },
  {
    question: "How is this different from E-E-A-T?",
    answer:
      "E-E-A-T is a broad quality lens. SearchTrust is a page and entity trust diagnosis model built for local pages and agency reporting.",
  },
  {
    question: "Is this only for Google?",
    answer:
      "Mainly for Google and local search today, but it also considers AI citation environments.",
  },
  {
    question: "Is this just another content quality checklist?",
    answer:
      "No. It focuses on layered qualification and interpretation, not just content quality checks.",
  },
  {
    question: "Does this replace technical SEO?",
    answer:
      "No. Technical SEO and this framework focus on different things. Both are important.",
  },
];

export function FrameworkFAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="py-20 bg-white">
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
