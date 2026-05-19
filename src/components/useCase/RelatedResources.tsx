"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, FileText, Layout, Tag, ArrowRight } from 'lucide-react';

export function RelatedResources() {
  const resources = [
    {
      title: "Framework",
      desc: "Deep dive into the 6-layer trust architecture.",
      icon: <Layout className="w-6 h-6" />,
      link: "#"
    },
    {
      title: "Sample Report",
      desc: "View a live demonstration of a full audit.",
      icon: <FileText className="w-6 h-6" />,
      link: "#"
    },
    {
      title: "Product Overview",
      desc: "Learn how Search Trust transforms your SEO.",
      icon: <BookOpen className="w-6 h-6" />,
      link: "#"
    },
    {
      title: "Pricing",
      desc: "Flexible plans for agencies and businesses.",
      icon: <Tag className="w-6 h-6" />,
      link: "#"
    }
  ];

  return (
    // 延续 image_c2903c.png 的冷灰背景规范
    <section className="pt-24 bg-[#F8F9FB]">
      <div className="container mx-auto max-w-[1300px] px-8">
        
        {/* 标题：延续大字号、深灰蓝、高字重风格 */}
        <div className="text-center mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[48px] md:text-[54px] font-bold text-[#1A212B] tracking-tight"
          >
            Related resources
          </motion.h2>
        </div>

        {/* 资源卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {resources.map((item, index) => (
            <motion.a
              key={index}
              href={item.link}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -8, backgroundColor: "#FFFFFF" }} // 悬停变为纯白，产生升起感
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              // 基础卡片色值参考 image_c2903c.png 的 #EBECEF
              className="bg-[#EBECEF] rounded-[40px] p-10 flex flex-col justify-between min-h-[320px] transition-all group border border-transparent hover:border-[#E2E4E8] hover:shadow-2xl hover:shadow-gray-200/50"
            >
              <div className="space-y-6">
                {/* 图标背景：使用品牌绿点缀 */}
                <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-[#1A212B] group-hover:text-[#A5D020] transition-colors shadow-sm">
                  {item.icon}
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-[22px] font-bold text-[#1A212B]">
                    {item.title}
                  </h3>
                  <p className="text-[15px] text-[#3E4651] font-medium leading-relaxed opacity-70">
                    {item.desc}
                  </p>
                </div>
              </div>

              {/* 底部交互提示 */}
              <div className="flex items-center gap-2 text-[14px] font-black uppercase tracking-widest text-[#1A212B] group-hover:text-[#A5D020] transition-colors">
                Explore <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}