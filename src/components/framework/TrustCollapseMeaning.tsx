"use client";

import React from 'react';
import { Ban, XCircle, AlertCircle } from 'lucide-react';

const notItems = [
  {
    icon: Ban,
    title: "Beyond technical health",
    desc: "A page can be crawlable, indexable, and technically sound while its business identity and real-world proof remain unclear.",
    meaning: "Technical health gets the page considered; trust signals help it become credible and defensible.",
  },
  {
    icon: XCircle,
    title: "Beyond content volume",
    desc: "Word count cannot replace specific local evidence, accountable claims, or a clear reason for the page to exist.",
    meaning: "Adding more copy may enlarge the page without repairing the trust layer that is failing.",
  },
  {
    icon: AlertCircle,
    title: "Earlier than ranking loss",
    desc: "Ranking loss is an outcome, not the diagnosis. A page can gain visibility before its weak structure is exposed.",
    meaning: "Finding the trust break early helps teams protect gains instead of reacting after rankings become unstable.",
  },
];

export function TrustCollapseMeaning() {
  return (
    <section className="pt-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* 标题区域 */}
        <div className="text-center mb-8">
          <h2 className="text-[32px] md:text-[42px] font-bold text-[#1A1F2B]">
            What <span className="text-bar-highlight">trust collapse</span> means
          </h2>
        </div>

        {/* 引用 */}
        <div className="max-w-3xl mx-auto mb-8 text-center">
          <p className="text-[16px] md:text-[18px] text-gray-500 leading-relaxed font-medium">
            Trust collapse happens when a page stops being interpreted as a credible, grounded,
            accountable local entry point — even if it contains keywords, content, and optimization signals.
          </p>
        </div>

        {/* 卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {notItems.map((item, index) => (
            <div
              key={index}
              className="bg-[#F8F9FA] rounded-[20px] p-8 flex flex-col items-start gap-4 transition-all hover:shadow-sm"
            >
              <item.icon
                size={24}
                strokeWidth={1.5}
                className="text-[#A5D020]"
              />
              <div className="flex flex-col gap-2">
                <h3 className="text-[18px] font-bold text-[#1A1F2B]">
                  {item.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-gray-500 font-medium">
                  {item.desc}
                </p>
                <p className="mt-2 border-t border-gray-200 pt-3 text-[13px] font-semibold leading-relaxed text-[#3F4A5A]">
                  {item.meaning}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
