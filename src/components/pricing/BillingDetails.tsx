"use client";

import React from 'react';
import { CreditCard, FileText, RefreshCcw, ShieldCheck, Info } from 'lucide-react';

const billingDetails = [
  { icon: CreditCard, label: 'One–time payment' },
  { icon: FileText, label: 'One report per purchase' },
  { icon: RefreshCcw, label: 'No automatic renewal' },
  { icon: ShieldCheck, label: 'Secure via Paddle' },
  { icon: Info, label: 'Location-based taxes' },
];

export function BillingDetails() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-[1200px] mx-auto px-8 text-center">
        <h2 className="text-[42px] font-bold mb-20">Billing details</h2>
        <div className="flex flex-wrap justify-center gap-10 md:gap-16">
          {billingDetails.map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-5 max-w-[140px]">
              <div className="w-16 h-16 bg-white border border-[#EBECEF] rounded-[22px] flex items-center justify-center shadow-sm">
                <item.icon size={24} strokeWidth={1.5} />
              </div>
              <span className="text-[13px] font-bold text-[#3E4651]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
