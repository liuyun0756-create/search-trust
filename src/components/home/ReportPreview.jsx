import React from 'react';
import { LogIn, FileText, AlertTriangle, CheckCircle2, Layout, ExternalLink } from 'lucide-react';

export function ReportPreview () {       
  return (
    <section className="py-24 bg-[#F9FAFB]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <div className="text-center mb-16">
          <h2 className="text-[36px] md:text-[42px] font-bold text-[#1A1F2B]">
            See what a Trust Collapse Report looks like
          </h2>
        </div>

        {/* 预览容器 */}
        <div className="max-w-6xl mx-auto grid items-stretch">
          
         <img src="/images/sample-report.png" alt="" />

        </div>
      </div>
    </section>
  );
};

