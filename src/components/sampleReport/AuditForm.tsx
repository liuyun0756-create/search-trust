"use client";

import React, { useState } from 'react';
import { ChevronDown, Loader2, Sparkles } from 'lucide-react';

export function AuditForm() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    url: '',
    gbpUrl: '',
    pageType: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // 模拟提交逻辑
    setTimeout(() => {
      setLoading(false);
      alert('Trust Audit Started for: ' + formData.url);
    }, 1500);
  };

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto max-w-4xl px-6">
        <form 
          onSubmit={handleSubmit}
          className="bg-[#F3F4F6] rounded-[32px] p-8 md:p-12 shadow-sm border border-gray-100"
        >
          <div className="space-y-6">
            {/* URL Input */}
            <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4">
              <label className="md:col-span-3 text-[15px] font-black text-[#1A1F2B] uppercase tracking-tight">
                URL
              </label>
              <div className="md:col-span-9">
                <input
                  required
                  type="url"
                  placeholder="required"
                  value={formData.url}
                  onChange={(e) => setFormData({...formData, url: e.target.value})}
                  className="w-full bg-white border-none rounded-xl px-6 py-4 text-[15px] focus:ring-2 focus:ring-[#A5D020] transition-all placeholder:text-gray-300 shadow-sm"
                />
              </div>
            </div>

            {/* GBP URL Input */}
            <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4">
              <label className="md:col-span-3 text-[15px] font-black text-[#1A1F2B] uppercase tracking-tight">
                GBP URL
              </label>
              <div className="md:col-span-9">
                <input
                  type="url"
                  placeholder="optional / recommended"
                  value={formData.gbpUrl}
                  onChange={(e) => setFormData({...formData, gbpUrl: e.target.value})}
                  className="w-full bg-white border-none rounded-xl px-6 py-4 text-[15px] focus:ring-2 focus:ring-[#A5D020] transition-all placeholder:text-gray-300 shadow-sm"
                />
              </div>
            </div>

            {/* Page Type Select */}
            <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4">
              <label className="md:col-span-3 text-[15px] font-black text-[#1A1F2B] uppercase tracking-tight">
                Page Type
              </label>
              <div className="md:col-span-9 relative">
                <select
                  required
                  value={formData.pageType}
                  onChange={(e) => setFormData({...formData, pageType: e.target.value})}
                  className="w-full bg-white border-none rounded-xl px-6 py-4 text-[15px] appearance-none focus:ring-2 focus:ring-[#A5D020] transition-all shadow-sm cursor-pointer"
                >
                  <option value="" disabled>required</option>
                  <option value="local-service">Local Service Page</option>
                  <option value="city-landing">City / Location Landing Page</option>
                  <option value="multi-location">Multi-location Content</option>
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="min-w-[240px] bg-[#2D2E32] text-white font-bold py-5 px-10 rounded-2xl hover:bg-[#1A1F2B] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Sparkles size={18} className="text-[#A5D020] group-hover:scale-125 transition-transform" />
                    <span className="text-[16px]">Run a Trust Audit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
        
        {/* 表单下方的辅助说明 [cite: 37] */}
        <p className="mt-8 text-center text-[13px] text-gray-400 font-medium">
          Note: This audit identifies structural trust weaknesses across six layers. [cite: 51]
        </p>
      </div>
    </section>
  );
}