"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceDot 
} from 'recharts';

// 模拟数据：代表 SEO 可见性的波动
const data = [
  { name: 'Start', visibility: 30, stage: '上线前信任审查' },
  { name: 'Step 1', visibility: 45, stage: '页面发布' },
  { name: 'Step 2', visibility: 40, stage: '监测排名 / GSC' },
  { name: 'Step 3', visibility: 35, stage: '若可见性停滞' },
  { name: 'Step 4', visibility: 65, stage: '运行信任诊断' },
  { name: 'Step 5', visibility: 85, stage: '优先修复' },
  { name: 'Step 6', visibility: 95, stage: '再次检测' },
];

export function WorkflowIntegrations() {
  return (
    <section className="pt-20 bg-[#F8F9FB]">
      <div className="container mx-auto max-w-[1200px] px-8">
        
        {/* 标题部分 */}
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[42px] md:text-[54px] font-bold text-[#1A212B] tracking-tight leading-tight"
          >
            Where <span className="text-[#A5D020]">Search Trust</span> fits in your workflow
          </motion.h2>
        </div>

        {/* 统计图容器：模仿 image_835154.png 中的波浪线，但进行 UI 升级 */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="bg-white rounded-[48px] p-10 md:p-16 shadow-sm border border-[#EBECEF]"
        >
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A5D020" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#A5D020" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F1F3" />
                <XAxis dataKey="name" hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#1A212B] text-white p-4 rounded-2xl shadow-xl border border-gray-800">
                          <p className="text-[14px] font-bold">{payload[0].payload.stage}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="visibility" 
                  stroke="#A5D020" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorVis)" 
                  animationDuration={2000}
                />
                
                {/* 在特定节点打点，模拟 image_835154.png 中的流程介入点 */}
                <ReferenceDot x="Step 4" y={65} r={8} fill="#1A212B" stroke="#white" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 下方流程文字索引 */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {data.map((step, index) => (
              <div key={index} className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Step 0{index + 1}</span>
                <p className="text-[13px] font-bold text-[#3E4651] leading-tight">
                  {step.stage}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 底部提示 */}
        {/* <p className="mt-10 text-center text-[14px] text-gray-400 font-medium">
          → Search Trust provides the diagnostic "bridge" when traditional growth plateaus.
        </p> */}
      </div>
    </section>
  );
}