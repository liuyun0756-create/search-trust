"use client";

import Link from "next/link";
import { RunAuditButton } from "@/components/common/RunAuditButton";

export function CTABanner() {
  return (
    <footer className="relative bg-[#0B0C0E] pt-20 pb-12">
      <div className="absolute inset-0 z-0 opacity-20">
        <img 
          src="/images/bottom-bg.png" 
          alt="Background" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C0E] via-transparent to-transparent"></div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* 核心 CTA 卡片 */}
        <div className="mb-24">
          <div className="bg-white/[0.08] backdrop-blur-md border border-white/10 rounded-2xl p-12 md:p-20 text-center max-w-5xl mx-auto">
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
              {/* <div className="w-6 h-6 grid grid-cols-2 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-sm"></div>
                ))}
              </div>
              <span className="text-xl font-bold text-white tracking-tight">SearchTrust</span> */}
              <div className="flex items-center">
                <img src="/images/logo-footer.png" alt="SearchTrust Logo" className="w-[120px] h-auto md:w-[175px] md:h-[32px]" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-8 max-w-[240px] leading-relaxed">
              Trust intelligence for local pages. Diagnose. Fix. Rank.
            </p>
            <div className="flex gap-4">
              {/* Facebook */}
              <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/30 transition-all">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              {/* Twitter / X */}
              <a href="https://x.com/home" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/30 transition-all">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
              </a>
              {/* Instagram */}
              <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/30 transition-all">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              {/* LinkedIn */}
              <a href="https://www.linkedin.cn/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/30 transition-all">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
            </div>
          </div>

          {/* 右侧链接网格 */}
          <div className="md:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              {/* <h4 className="text-white font-bold mb-6">Product</h4> */}
              <ul className="space-y-4 text-gray-500 text-sm font-medium">
                <li><a href="/" className=" text-white hover:text-[#A5D020] transition-colors">Home</a></li>
                <li><a href="/framework" className=" text-white hover:text-[#A5D020] transition-colors">Framework</a></li>
                <li><a href="/sample-report" className="text-white hover:text-[#A5D020] transition-colors">Sample Report</a></li>
                <li><a href="/pricing" className="text-white hover:text-[#A5D020] transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              {/* <h4 className="text-white font-bold mb-6">Use Cases</h4> */}
              <ul className="space-y-4 text-gray-500 text-sm font-medium">
                <li><a href="/use-cases" className=" text-white hover:text-[#A5D020] transition-colors">Use Cases</a></li>
                <li><a href="#" className="text-white hover:text-[#A5D020] transition-colors">Contact</a></li>
                {/* <li><a href="#" className="text-white hover:text-[#A5D020] transition-colors">Blog</a></li> */}
              </ul>
            </div>
            <div>
              {/* <h4 className="text-white font-bold mb-6">Legal</h4> */}
              <ul className="space-y-4 text-gray-500 text-sm font-medium">
                <li><a href="/policy" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#A5D020] transition-colors">Terms</a></li>
                <li><a href="/policy" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#A5D020] transition-colors">Privacy</a></li>
                <li><a href="/policy" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#A5D020] transition-colors">Refunds</a></li>
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