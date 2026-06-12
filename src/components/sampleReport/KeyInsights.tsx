"use client";

import { useState } from 'react';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const insights = [
  {
    num: '1',
    text: 'The page is not failing because it lacks content volume.',
  },
  {
    num: '2',
    text: 'Its local claim is weakly grounded and unsupported by real-world anchors.',
  },
  {
    num: '3',
    text: 'The business presence is implied, but accountability signals are incomplete.',
  },
  {
    num: '4',
    text: 'The page resembles a scalable city template more than a standalone local destination.',
  },
  {
    num: '5',
    text: 'The best first fix is not "add more text" but strengthen location-service grounding.',
  },
];

export function KeyInsights() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeInsight = insights[activeIndex];

  const showPrevious = () => {
    setActiveIndex((current) => (current === 0 ? insights.length - 1 : current - 1));
  };

  const showNext = () => {
    setActiveIndex((current) => (current === insights.length - 1 ? 0 : current + 1));
  };

  return (
    <section className="py-20 bg-[#F9FAFB]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader title="Key insights from this sample" />

        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-[28px] border border-gray-100 bg-white p-8 shadow-[0_12px_42px_rgba(15,23,42,0.05)]">
            <div className="flex min-h-[150px] items-center gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F4F7E9] border border-[#A5D020]/20">
                <span className="text-[15px] font-bold text-[#7DA312]">
                  {activeInsight.num}
                </span>
              </div>
              <p className="text-[20px] md:text-[24px] leading-relaxed text-[#1A1F2B] font-semibold tracking-tight">
                {activeInsight.text}
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4 border-t border-gray-100 pt-5">
              <div className="flex gap-2">
                {insights.map((item, index) => (
                  <button
                    key={item.num}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Show insight ${item.num}`}
                    className={`h-2.5 rounded-full transition-all ${
                      activeIndex === index ? 'w-8 bg-[#A5D020]' : 'w-2.5 bg-gray-200 hover:bg-gray-300'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={showPrevious}
                  aria-label="Previous insight"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:border-[#A5D020]/50 hover:text-[#7DA312]"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={showNext}
                  aria-label="Next insight"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:border-[#A5D020]/50 hover:text-[#7DA312]"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
