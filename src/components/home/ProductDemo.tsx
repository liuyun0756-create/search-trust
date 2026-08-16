"use client";

import React from 'react';

const levels = [
  { id: "L1", title: "Foundation", desc: "Does the page establish a clear service, topic, and local intent?" },
  { id: "L2", title: "Entity Presence", desc: "Can a real business entity be identified from the checked signals?" },
  { id: "L3", title: "Entity Consistency", desc: "Do identity signals remain consistent across the checked sources?" },
  { id: "L4", title: "Specificity", desc: "Is the content concrete and page-specific rather than reusable?" },
  { id: "L5", title: "Real-World Connection", desc: "Does the page connect its claims to places, work, time, and real activity?" },
  { id: "L6", title: "Accountability", desc: "Does the page show who is responsible for the service and its claims?" },
  { id: "L7", title: "Page Unique Value", desc: "Does the page provide a distinct reason to exist on its own?" },
  { id: "L8", title: "Algorithm Fit", desc: "After earlier layers are stable, does the page fit current search and AI citation expectations?" }
];

export function ProductDemo() {
  return (
    <section className="relative w-full overflow-hidden bg-[#0B0C0E] py-20">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: "url('/images/l0-l5-bg.jpg')",
            backgroundSize: '100% auto',
            backgroundPosition: 'left bottom',
            backgroundRepeat: 'no-repeat',
            maskImage: 'linear-gradient(to right, black 20%, transparent 80%)',
            WebkitMaskImage: 'linear-gradient(to right, black 20%, transparent 80%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0B0C0E]/50 to-[#0B0C0E]" />
      </div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div className="w-full max-w-[640px] lg:sticky lg:top-24">
            <div>
              <h2 className="text-[40px] md:text-[44px] font-extrabold text-white leading-[1.1] tracking-tighter">
                The SearchTrust 8-Layer Trust Model
              </h2>
              <div className="mb-8 h-1.5 w-[72px] rounded-full bg-[#A5D020]" />
              <p className="text-gray-400 text-[18px] leading-relaxed max-w-md font-medium">
                A structural framework for diagnosing whether a page has the evidence, entity signals, and accountability needed to compete as a local entry point.
              </p>
            </div>

            <div className="mt-12 w-full border-l-2 border-[#A5D020] pl-5">
              <p className="text-gray-400 text-[15px] font-medium leading-relaxed">
                SearchTrust maps each finding to its trust layer, source evidence, recommended action, and place in the implementation roadmap.
              </p>
            </div>
          </div>

          <div className="grid w-full max-w-[640px] grid-cols-1 gap-3 sm:grid-cols-2">
            {levels.map((level) => (
              <article
                key={level.id}
                className="min-h-[164px] overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center bg-[#A5D020] text-sm font-extrabold text-[#101217]">
                    {level.id}
                  </span>
                  <h3 className="text-[17px] font-bold text-white">{level.title}</h3>
                </div>
                <p className="text-[14px] font-medium leading-6 text-gray-400">{level.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
