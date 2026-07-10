"use client";

import React from 'react';
import { motion } from 'framer-motion';

export function ExampleFailTrust() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[32px] md:text-[42px] font-bold text-[#1A1F2B] mb-4"
          >
            Example: how a local page fails trust
          </motion.h2>
          {/* <p className="text-[16px] text-gray-500 font-medium max-w-xl mx-auto">
            See how SearchTrust diagnoses trust failures and maps them to specific recovery actions.
          </p> */}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto"
        >
          <div className="bg-[#F8F9FA] rounded-[24px] overflow-hidden border border-gray-100">
            <img
              src="/images/six-layer-trust-model.png"
              alt="Example: how a local page fails trust"
              className="w-full h-auto"
            />
          </div>
        </motion.div>

      </div>
    </section>
  );
}
