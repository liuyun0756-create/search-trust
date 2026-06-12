"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, RotateCcw, ArrowRight } from 'lucide-react';

export function DeliveryRefund() {
  return (
    <section className="bg-[#FFFFFF] pt-20 px-6">
      <div className="max-w-7xl mx-auto space-y-32">
        
        {/* 1. Delivery Section: 文字左 + 图片右 */}
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1"
          >
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-sm text-[#A5D020] border border-gray-100">
              <Clock size={24} strokeWidth={2.5} />
            </div>
            <h2 className="text-[36px] md:text-[42px] font-bold text-[#1A212B] tracking-tighter leading-[1.1] mb-6">
              Delivery
            </h2>
            <div className="space-y-4 max-w-lg">
              <p className="text-[18px] text-[#1A212B] font-bold leading-relaxed">
                After payment, submit the URL you want reviewed.
                Your report will be delivered via <span className="text-[#A5D020] underline decoration-[#A5D020] decoration-2 underline-offset-4">e-mail within two hours</span>. 

              </p>
              <p className="text-[16px] text-[#6B7280] font-medium leading-relaxed">
                Delivery times are estimates and may vary slightly based on demand or technical processing requirements.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1 w-full"
          >
            <div className="w-[600px] h-[275px] rounded-[32px] bg-white border border-gray-100 shadow-sm overflow-hidden">
              <img src="/images/delivery-bg.png" alt="Delivery" className="w-full h-full object-cover" />
            </div>
          </motion.div>
        </div>

        {/* 2. Refund Policy Section: 图片左 + 文字右 */}
        <div className="flex flex-col lg:min-h-[400px] lg:flex-row-reverse items-center gap-12 lg:gap-10">
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1 lg:-ml-4"
          >
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-sm text-[#A5D020] border border-gray-100">
              <RotateCcw size={24} strokeWidth={2.5} />
            </div>
            <h2 className="text-[36px] md:text-[42px] font-bold text-[#1A212B] tracking-tighter leading-[1.1] mb-6">
              Refund policy
            </h2>
            <div className="space-y-6 max-w-lg">
              <p className="text-[18px] text-[#1A212B] font-bold leading-relaxed">
                Refunds may be available before processing begins.
              </p>
              <p className="text-[16px] text-[#6B7280] font-medium leading-relaxed">
                Once report processing has started or the report has been delivered, purchases are generally non-refundable.
              </p>
              <a 
                href="/policy" 
                className="inline-flex items-center gap-2 text-[14px] font-black uppercase tracking-widest text-[#A5D020] hover:text-[#7FA40F] transition-all group"
              >
                See our Refund Policy for full details.
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1 w-full"
          >
            <div className="w-full max-w-[598px] h-[273px] rounded-[32px] overflow-hidden">
              <img src="/images/refund-bg.png" alt="Refund Policy" className="w-full h-full object-cover" />
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
