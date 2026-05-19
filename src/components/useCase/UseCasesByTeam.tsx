"use client";

import React from 'react';
import { motion } from 'framer-motion';

export function UseCasesByTeam() {
  const cases = [
    {
      title: "SEO Agencies",
      items: ["pre–publish QA", "stuck page diagnosis", "client reporting"]
    },
    {
      title: "Local SEO Specialists",
      items: ["local page qualification", "trust breakdown analysis", "page improvement prioritization"]
    },
    {
      title: "Affiliate Marketers",
      items: ["scaled page review", "doorway–risk detection", "template quality control"]
    },
    {
      title: "Multi–location Businesses",
      items: ["location page consistency", "local entity alignment", "standalone value checks"]
    }
  ];

  return (
    // 关键修正 1：背景色改为原型中的极淡冷灰色 #F8F9FB
    <section className="pt-24 bg-[#F8F9FB]">
      <div className="container mx-auto max-w-[1300px] px-8">
        
        {/* 关键修正 2：标题颜色改为深灰蓝 #1A212B，增加字间距 */}
        <h2 className="text-center text-[48px] md:text-[54px] font-bold text-[#1A212B] mb-24 tracking-tight leading-tight">
          Use cases by team type
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cases.map((useCase, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              // 关键修正 3：卡片颜色改为 #EBECEF，圆角 48px 更加圆润
              className="bg-[#EBECEF] rounded-[48px] p-12 flex flex-col items-center min-h-[380px] transition-colors"
            >
              {/* 关键修正 4：卡片标题高度固定，确保列表对齐 */}
              <h3 className="text-[22px] font-bold text-[#1A212B] mb-12 text-center h-[60px] flex items-center justify-center leading-[1.2]">
                {useCase.title}
              </h3>

              {/* 关键修正 5：列表打点改为更纤细的黑色微点 */}
              <ul className="space-y-5 w-full">
                {useCase.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-[16px] text-[#3E4651] font-medium leading-[1.5]">
                    <span className="mt-[9px] w-[5px] h-[5px] rounded-full bg-[#1A212B] shrink-0 opacity-80" />
                    <span className="opacity-90 tracking-tight">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}