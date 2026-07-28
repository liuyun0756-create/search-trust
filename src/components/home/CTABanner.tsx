"use client";

export function CTABanner() {
  return (
    <footer className="relative overflow-hidden bg-[#F7F9F2] pt-20 pb-12">
      <div className="absolute inset-0 z-0 opacity-[0.08]">
        <img 
          src="/images/bottom-bg.jpg" 
          alt="Background" 
          className="w-full h-full object-cover"
        />
      </div>
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(165,208,32,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(26,31,43,0.04)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-[#A5D020]/40 to-transparent" />
      <div className="absolute left-1/2 top-8 z-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#A5D020]/16 blur-[100px]" />

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* 底部导航区域 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 border-t border-[#1A1F2B]/10 pt-16">
          
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
                <img src="/images/logo.png" alt="SearchTrust Logo" className="w-[120px] h-auto md:w-[175px] md:h-[32px]" />
              </div>
            </div>
            <p className="text-[#657083] text-sm mb-8 max-w-[240px] leading-relaxed">
              Trust intelligence for local pages. Diagnose. Fix. Rank.
            </p>
            <div className="flex gap-4">
              {/* Facebook */}
              <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-[#1A1F2B] hover:border-[#A5D020]/60 transition-all">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              {/* Twitter / X */}
              <a href="https://x.com/home" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-[#1A1F2B] hover:border-[#A5D020]/60 transition-all">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
              </a>
              {/* Instagram */}
              <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-[#1A1F2B] hover:border-[#A5D020]/60 transition-all">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              {/* LinkedIn */}
              <a href="https://www.linkedin.cn/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-[#1A1F2B] hover:border-[#A5D020]/60 transition-all">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
            </div>
          </div>

          {/* 右侧链接网格 */}
          <div className="md:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              {/* <h4 className="text-white font-bold mb-6">Product</h4> */}
              <ul className="space-y-4 text-sm font-medium">
                <li><a href="/" className="text-[#1A1F2B] hover:text-[#7FA40F] transition-colors">Home</a></li>
                <li><a href="/framework" className="text-[#1A1F2B] hover:text-[#7FA40F] transition-colors">Framework</a></li>
                <li><a href="/sample-report" className="text-[#1A1F2B] hover:text-[#7FA40F] transition-colors">Sample Report</a></li>
                <li><a href="/pricing" className="text-[#1A1F2B] hover:text-[#7FA40F] transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              {/* <h4 className="text-white font-bold mb-6">Use Cases</h4> */}
              <ul className="space-y-4 text-sm font-medium">
                <li><a href="/use-cases" className="text-[#1A1F2B] hover:text-[#7FA40F] transition-colors">Use Cases</a></li>
                <li><a href="/use-cases" className="text-[#1A1F2B] hover:text-[#7FA40F] transition-colors">Contact</a></li>
                {/* <li><a href="#" className="text-white hover:text-[#A5D020] transition-colors">Blog</a></li> */}
              </ul>
            </div>
            <div>
              {/* <h4 className="text-white font-bold mb-6">Legal</h4> */}
              <ul className="space-y-4 text-sm font-medium">
                <li><a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#1A1F2B] hover:text-[#7FA40F] transition-colors">Terms</a></li>
                <li><a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#1A1F2B] hover:text-[#7FA40F] transition-colors">Privacy</a></li>
                <li><a href="/refund-policy" target="_blank" rel="noopener noreferrer" className="text-[#1A1F2B] hover:text-[#7FA40F] transition-colors">Refunds</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="mt-24 text-center">
          <p className="text-gray-500 text-xs">
            © 2026 SearchTrust. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}
