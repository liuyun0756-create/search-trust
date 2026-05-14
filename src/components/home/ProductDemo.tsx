"use client";

import React from 'react';
import { Sparkles } from 'lucide-react';

const levels = [
  { id: "L0", title: "Qualification", desc: "Does the page even qualify to compete?" },
  { id: "L1", title: "Specificity", desc: "Is it concrete enough to feel real, or generic enough to be reused anywhere?" },
  { id: "L2", title: "Real-World Anchors", desc: "Does it connect to places, service context, time, and reality?" },
  { id: "L3", title: "Responsibility", desc: "Does the page reflect real business accountability, not just claims?" },
  { id: "L4", title: "Standalone Value", desc: "Does this deserve to exist on its own?" },
  { id: "L5", title: "Era Fit", desc: "Is the page structure adapted to today's Google and AI search environment?" }
];

const CurvedConnectors = () => {
  const ITEM_HEIGHT = 140;
  const CURVE_RADIUS = 20;
  const START_X = 20;
  const LINE_LENGTH = 80;
  const BRANCH_Y_OFFSET = 44; // 分支线对齐到每行图标中心的偏移量

  const generatePath = () => {
    const lastY = (levels.length - 1) * ITEM_HEIGHT + BRANCH_Y_OFFSET;
    let d = `M ${START_X} 0 V ${lastY + CURVE_RADIUS}`;

    levels.forEach((_, index) => {
      const y = index * ITEM_HEIGHT + BRANCH_Y_OFFSET;
      d += ` M ${START_X} ${y - CURVE_RADIUS} Q ${START_X} ${y} ${START_X + CURVE_RADIUS} ${y} H ${START_X + LINE_LENGTH}`;
    });
    return d;
  };

  const totalHeight = ITEM_HEIGHT * levels.length - 96;

  return (
    <svg className="absolute inset-0 z-0 pointer-events-none" width="100%" height={totalHeight}>
      <path
        d={generatePath()}
        stroke="#374151"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
};

export function ProductDemo() {
  return (
    <section className="relative min-h-[900px] w-full bg-[#0B0C0E] py-24 flex items-center overflow-hidden">
      
      {/* 背景图层 - 修正了背景尺寸和位置 */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: "url('/images/l0-l5-bg.png')",
            backgroundSize: '100% auto',
            backgroundPosition: 'left bottom',
            backgroundRepeat: 'no-repeat',
            maskImage: 'linear-gradient(to right, black 20%, transparent 80%)',
            WebkitMaskImage: 'linear-gradient(to right, black 20%, transparent 80%)',
          }}
        />
        {/* 压暗渐变，确保文字可读性 */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0B0C0E]/50 to-[#0B0C0E]" />
      </div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          
          {/* 左侧：标题与文案 */}
          <div className="lg:sticky lg:top-24 w-full h-full max-w-[640px] flex flex-col">
            <div className="flex-1">
              <h2 className="text-[40px] md:text-[44px] font-extrabold text-white leading-[1.1] mb-8 tracking-tighter">
                The L0—L5 Trust Collapse Model
              </h2>
              <p className="text-gray-400 text-[18px] leading-relaxed max-w-md font-medium">
                A structural framework for diagnosing whether a page qualifies as a real local entity entry point.
              </p>
            </div>

            <div className="w-full mt-24">
               <p className="text-gray-500 text-[14px] font-medium pl-4 leading-relaxed">
                Search Trust doesn't just flag issues. It shows where trust collapses in the page's structure.
              </p>
            </div>
          </div>

          {/* 右侧：层级列表 */}
          <div className="relative py-4 w-full max-w-[640px]">
           <img src="/images/layer-bg.png" alt="" className="w-full h-auto" />
          </div>

        </div>
      </div>
    </section>
  );
}