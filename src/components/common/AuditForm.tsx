"use client";

import React, { useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useAuditModal } from '@/components/common/AuditModalProvider';
import { PAGE_TYPES } from '@/lib/constants';

interface AuditFormProps {
  floating?: boolean;
}

export function AuditForm({ floating = false }: AuditFormProps) {
  const [loading, setLoading] = useState(false);
  const submissionRef = useRef(false);
  const [formData, setFormData] = useState({
    url: '',
    gbpUrl: '',
    pageType: 'Service Page',
  });

  const { submitAuditForm } = useAuditModal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.url.trim() || !formData.pageType.trim() || submissionRef.current) return;

    submissionRef.current = true;
    setLoading(true);

    try {
      await submitAuditForm({
        url: formData.url.trim(),
        pageType: formData.pageType,
        gbpUrl: formData.gbpUrl.trim(),
      });
    } catch (err) {
      console.error("Submit error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  };

  const wrapperClass = floating
    ? "absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20 w-full max-w-6xl overflow-hidden rounded-2xl border border-[#D9E7AE] bg-white p-10 shadow-[0_24px_64px_rgba(15,23,42,0.14)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-[#A5D020]"
    : "relative z-20 -mt-37 mx-auto max-w-6xl overflow-hidden rounded-2xl border border-[#D9E7AE] bg-white p-10 shadow-[0_24px_64px_rgba(15,23,42,0.14)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-[#A5D020]";

  return (
    <form onSubmit={handleSubmit} className={wrapperClass}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
        {/* URL Input */}
        <div className="flex flex-col gap-3">
          <label className="text-[14px] font-bold text-[#1A1F2B] tracking-tight">
            URL
            <span className="ml-1 text-[#EF4444]">*</span>
          </label>
          <input
            required
            type="url"
            placeholder="Enter the page URL to audit"
            value={formData.url}
            onChange={(e) => setFormData({...formData, url: e.target.value})}
            className="w-full rounded-lg border border-[#CDD3DD] bg-[#FCFCFD] px-5 py-3.5 text-[14px] shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all placeholder:text-[#929BAD] hover:border-[#AEB7C5] focus:border-[#8FB713] focus:bg-white focus:ring-2 focus:ring-[#A5D020]/25"
          />
        </div>

        {/* GBP URL Input */}
        <div className="flex flex-col gap-3">
          <label className="text-[14px] font-bold text-[#1A1F2B] tracking-tight">
            GBP URL
          </label>
          <input
            type="url"
            placeholder="Enter the GBP URL"
            value={formData.gbpUrl}
            onChange={(e) => setFormData({...formData, gbpUrl: e.target.value})}
            className="w-full rounded-lg border border-[#CDD3DD] bg-[#FCFCFD] px-5 py-3.5 text-[14px] shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all placeholder:text-[#929BAD] hover:border-[#AEB7C5] focus:border-[#8FB713] focus:bg-white focus:ring-2 focus:ring-[#A5D020]/25"
          />
        </div>

        {/* Page Type Select */}
        <div className="flex flex-col gap-3">
          <label htmlFor="audit-page-type" className="text-[14px] font-bold text-[#1A1F2B] tracking-tight">
            Page Type
            <span className="ml-1 text-[#EF4444]">*</span>
          </label>
          <div className="relative">
            <select
              id="audit-page-type"
              required
              aria-label="Page Type"
              value={formData.pageType}
              onChange={(e) => setFormData({...formData, pageType: e.target.value})}
              className="w-full cursor-pointer appearance-none rounded-lg border border-[#CDD3DD] bg-[#FCFCFD] px-5 py-3.5 text-[14px] shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all hover:border-[#AEB7C5] focus:border-[#8FB713] focus:bg-white focus:ring-2 focus:ring-[#A5D020]/25"
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
          disabled={loading || !formData.url.trim() || !formData.pageType.trim()}
          className="flex min-w-[190px] items-center justify-center rounded-lg bg-[#1A1F2B] px-9 py-3.5 font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition-all hover:bg-black hover:shadow-[0_14px_30px_rgba(15,23,42,0.24)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
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
