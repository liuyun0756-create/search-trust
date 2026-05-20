"use client";

import React, { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

interface AuditFormProps {
  floating?: boolean;
}

export function AuditForm({ floating = false }: AuditFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    url: '',
    gbpUrl: '',
    pageType: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.url.trim() || !formData.pageType) {
      return;
    }
    setLoading(true);
    // TODO: 对接后端 API
    setTimeout(() => {
      setLoading(false);
      alert('Trust Audit Started');
    }, 1500);
  };

  const wrapperClass = floating
    ? "absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20 w-full max-w-6xl bg-white rounded-[24px] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100"
    : "relative z-20 -mt-37 mx-auto max-w-6xl px-6 bg-white rounded-[24px] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100";

  return (
    <form
      onSubmit={handleSubmit}
      className={wrapperClass}
    >
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

      <div className="flex justify-center">
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-3 bg-[#1A1F2B] text-white font-bold rounded-xl hover:bg-black hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-70"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <span className="text-[15px] tracking-tight">Run a Trust Audit</span>
          )}
        </button>
      </div>
    </form>
  );
}
