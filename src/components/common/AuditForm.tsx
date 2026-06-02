"use client";

import React, { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useAuditModal } from '@/components/common/AuditModalProvider';
import { submitAudit } from '@/lib/submit-audit';
import { PAGE_TYPES } from '@/lib/constants';

interface AuditFormProps {
  floating?: boolean;
}

export function AuditForm({ floating = false }: AuditFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    url: '',
    gbpUrl: '',
    pageType: 'Service Page',
  });

  const { isSignedIn } = useUser();
  const router = useRouter();
  const { openLogin, openAuditForm } = useAuditModal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.url.trim()) return;

    setLoading(true);

    try {
      // Step 1: 判断登录
      if (!isSignedIn) {
        setLoading(false);
        openLogin();
        return;
      }

      // Step 2: 判断 credits
      const creditsRes = await fetch("/api/user/credits");
      if (creditsRes.ok) {
        const { credits } = await creditsRes.json();
        if (credits <= 0) {
          setLoading(false);
          // 跳转支付（使用 PaymentModal 通过 AuditModalProvider）
          openAuditForm();
          return;
        }
      }

      // Step 3: 跑报告
      const { report_id } = await submitAudit({
        url: formData.url,
        pageType: formData.pageType,
        gbpUrl: formData.gbpUrl,
      });
      router.push(`/reports?report_id=${report_id}`);
    } catch (err) {
      console.error("Submit error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const wrapperClass = floating
    ? "absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20 w-full max-w-6xl bg-white rounded-[24px] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100"
    : "relative z-20 -mt-37 mx-auto max-w-6xl px-6 bg-white rounded-[24px] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100";

  return (
    <form onSubmit={handleSubmit} className={wrapperClass}>
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
            GBP URL
          </label>
          <input
            required
            type="url"
            placeholder="required"
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
              className="w-full bg-white border border-gray-100 rounded-xl px-5 py-3.5 text-[14px] appearance-none focus:ring-2 focus:ring-[#A5D020] focus:border-transparent outline-none transition-all cursor-pointer"
            >
              {PAGE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={18} />
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="submit"
          disabled={loading || !formData.url.trim()}
          className="px-8 py-3 bg-[#1A1F2B] text-white font-bold rounded-xl hover:bg-black hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
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
