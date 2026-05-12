"use client";

import Link from "next/link";
import { RunAuditButton } from "@/components/common/RunAuditButton";

export function CTABanner() {
  return (
    <footer className="relative bg-[#0B0C0E] pt-24 pb-12">
      {/* 背景图容器 - 建议在此处传入你提到的背景图 */}
      <div className="absolute inset-0 z-0 opacity-40">
        <img 
          src="/your-background-image.jpg" 
          alt="Background" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C0E] via-transparent to-transparent"></div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* 核心 CTA 卡片 */}
        <div className="mb-24">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[32px] p-12 md:p-20 text-center max-w-5xl mx-auto">
            <h2 className="text-[32px] md:text-[48px] font-bold text-white mb-8 leading-tight">
              Stop guessing why pages don’t rank.<br />
              <span className="text-white/90">See where trust breaks.</span>
            </h2>
            <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
              A structural framework for diagnosing whether a page qualifies as a real local entity entry point.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <RunAuditButton className="w-full sm:w-auto px-8 py-4 bg-white text-[#0B0C0E] font-bold rounded-xl hover:bg-gray-200 transition-colors">
                Run a Trust Audit
              </RunAuditButton>
              <Link href="/sample-case" target="_blank" className="w-full sm:w-auto px-8 py-4 bg-transparent border border-white/20 text-white font-bold rounded-xl hover:bg-white/5 transition-all text-center">
                View Sample Report
              </Link>
            </div>
          </div>
        </div>

        {/* 底部导航区域 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 border-t border-white/10 pt-16">
          
          {/* 左侧品牌信息 */}
          <div className="md:col-span-4">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 grid grid-cols-2 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-sm"></div>
                ))}
              </div>
              <span className="text-xl font-bold text-white tracking-tight">SearchTrust</span>
            </div>
            <p className="text-gray-500 text-sm mb-8 max-w-[240px] leading-relaxed">
              Trust intelligence for local pages. Diagnose. Fix. Rank.
            </p>
            {/* <div className="flex gap-4">
              {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/30 transition-all">
                  <Icon size={18} />
                </a>
              ))}
            </div> */}
          </div>

          {/* 右侧链接网格 */}
          <div className="md:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              <h4 className="text-white font-bold mb-6">Product</h4>
              <ul className="space-y-4 text-gray-500 text-sm font-medium">
                <li><a href="#" className="hover:text-[#A5D020] transition-colors">Framework</a></li>
                <li><a href="#" className="hover:text-[#A5D020] transition-colors">Sample Report</a></li>
                <li><a href="#" className="hover:text-[#A5D020] transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Use Cases</h4>
              <ul className="space-y-4 text-gray-500 text-sm font-medium">
                <li><a href="#" className="hover:text-[#A5D020] transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-[#A5D020] transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Legal</h4>
              <ul className="space-y-4 text-gray-500 text-sm font-medium">
                <li><a href="/policy" className="hover:text-[#A5D020] transition-colors">Privacy</a></li>
                <li><a href="/policy" className="hover:text-[#A5D020] transition-colors">Terms</a></li>
                <li><a href="/policy" className="hover:text-[#A5D020] transition-colors">Refunds</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="mt-24 text-center">
          <p className="text-gray-600 text-xs">
            © 2026 SearchTrust. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}