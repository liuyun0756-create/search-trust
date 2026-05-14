"use client";

import React, { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

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
    setTimeout(() => {
      setLoading(false);
      alert('Trust Audit Started');
    }, 1500);
  };

  return (
    <section className="py-20 bg-transparent relative z-10">
      <div className="container mx-auto max-w-6xl px-6">
        <form 
          onSubmit={handleSubmit}
          className="bg-white rounded-[24px] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100"
        >
          {/* 三列输入区域：对齐 image_66dd1a.png 的横向布局 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            
            {/* URL Input */}
            <div className="flex flex-col gap-3">
              <label className="text-[14px] font-bold text-[#1A1F2B] tracking-tight">
                URL
              </label>
              <input
                required
                type="url"
                placeholder="required"
                value={formData.url}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
                className="w-full bg-white border border-gray-100 rounded-xl px-5 py-3.5 text-[14px] focus:ring-2 focus:ring-[#A5D020] focus:border-transparent outline-none transition-all placeholder:text-gray-300"
              />
            </div>

            {/* GBP URL Input */}
            <div className="flex flex-col gap-3">
              <label className="text-[14px] font-bold text-[#1A1F2B] tracking-tight">
                GBPURL
              </label>
              <input
                type="url"
                placeholder="optional / recommended"
                value={formData.gbpUrl}
                onChange={(e) => setFormData({...formData, gbpUrl: e.target.value})}
                className="w-full bg-white border border-gray-100 rounded-xl px-5 py-3.5 text-[14px] focus:ring-2 focus:ring-[#A5D020] focus:border-transparent outline-none transition-all placeholder:text-gray-300"
              />
            </div>

            {/* Page Type Select */}
            <div className="flex flex-col gap-3">
              <label className="text-[14px] font-bold text-[#1A1F2B] tracking-tight">
                Page Type
              </label>
              <div className="relative">
                <select
                  required
                  value={formData.pageType}
                  onChange={(e) => setFormData({...formData, pageType: e.target.value})}
                  className="w-full bg-white border border-gray-100 rounded-xl px-5 py-3.5 text-[14px] appearance-none focus:ring-2 focus:ring-[#A5D020] focus:border-transparent outline-none transition-all cursor-pointer text-gray-400"
                >
                  <option value="" disabled>required</option>
                  <option value="service">Service Page</option>
                  <option value="landing">Landing Page</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={18} />
              </div>
            </div>
          </div>

          {/* 提交按钮：居中黑底白字 */}
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={loading}
              className="min-w-[220px] bg-[#1A1F2B] text-white font-bold py-4 px-8 rounded-xl hover:bg-black hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <span className="text-[15px] tracking-tight">Run a Trust Audit</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}