"use client";

import { useEffect, useRef, useState } from "react";
import { X, Globe, MapPin, MapPinned, LayoutTemplate, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AuditLocationModeTabs,
  type AuditLocationMode,
} from "@/components/common/AuditLocationModeTabs";
import { PAGE_TYPES } from "@/lib/constants";

interface AuditFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { url: string; gbpUrl: string; locationContext: string; pageType: string }) => void;
  submitting?: boolean;
  initialValues?: { url: string; gbpUrl: string; locationContext: string; pageType: string } | null;
}

export function AuditFormModal({ isOpen, onClose, onSubmit, submitting, initialValues }: AuditFormModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  const [gbpUrl, setGbpUrl] = useState("");
  const [locationContext, setLocationContext] = useState("");
  const [locationMode, setLocationMode] = useState<AuditLocationMode>("single");
  const [pageType, setPageType] = useState("Service Page");

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setUrl(initialValues?.url || "");
      setGbpUrl(initialValues?.gbpUrl || "");
      setLocationContext(initialValues?.locationContext || "");
      setLocationMode(initialValues?.locationContext ? "multi" : "single");
      setPageType(initialValues?.pageType || "Service Page");
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [initialValues, isOpen]);

  const handleSubmit = () => {
    if (!url.trim() || !pageType.trim() || submitting) return;
    onSubmit({
      url: url.trim(),
      gbpUrl: gbpUrl.trim(),
      locationContext: locationMode === "multi" ? locationContext.trim() : "",
      pageType,
    });
  };

  const handleLocationModeChange = (mode: AuditLocationMode) => {
    setLocationMode(mode);
    if (mode === "single") {
      setLocationContext("");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#0B0C0E]/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-[#F8F9FA] rounded-[32px] w-full max-w-[480px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/50"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#A5D020]/10 blur-[60px] rounded-full -mr-16 -mt-16 pointer-events-none" />

            <button
              type="button"
              onClick={onClose}
              aria-label="Close audit form"
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-100 text-gray-400 hover:text-[#1A212B] hover:shadow-sm transition-all z-20"
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            <div className="p-10 md:p-12 pt-16 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-100 shadow-sm mb-6">
                <div className="w-2 h-2 rounded-full bg-[#A5D020] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Trust Audit</span>
              </div>

              <h2 className="text-[28px] font-bold text-[#1A212B] leading-[1.15] tracking-tighter mb-2">
                Run a <span className="text-[#A5D020]">Trust</span> Audit
              </h2>
              <p className="text-[14px] text-[#6B7280] font-medium leading-relaxed mb-8">
                Enter the page details to generate a comprehensive trust diagnosis report.
              </p>

              <AuditLocationModeTabs
                value={locationMode}
                onChange={handleLocationModeChange}
                className="mb-7 w-full justify-center"
              />

              <div className="space-y-5">
                {/* URL */}
                <div>
                  <label className="text-[12px] font-black uppercase tracking-widest text-gray-400 mb-2 block">
                    Page URL <span className="text-[#A5D020]">*</span>
                  </label>
                  <div className="relative">
                    <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input
                      required
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/local-service"
                      className="w-full bg-white border border-gray-100 rounded-xl pl-11 pr-4 py-3.5 text-[14px] font-medium text-[#1A212B] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A5D020]/20 transition-all"
                    />
                  </div>
                </div>

                {/* GBP URL */}
                <div>
                  <label className="text-[12px] font-black uppercase tracking-widest text-gray-400 mb-2 block">
                    GBP URL
                  </label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input
                      type="url"
                      value={gbpUrl}
                      onChange={(e) => setGbpUrl(e.target.value)}
                      placeholder="https://maps.google.com/..."
                      className="w-full bg-white border border-gray-100 rounded-xl pl-11 pr-4 py-3.5 text-[14px] font-medium text-[#1A212B] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A5D020]/20 transition-all"
                    />
                  </div>
                </div>

                {locationMode === "multi" && (
                  <div>
                    <label className="mb-2 block text-[12px] font-black uppercase tracking-widest text-gray-400">
                      Target city or region
                    </label>
                    <div className="relative">
                      <MapPinned size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                      <input
                        type="text"
                        value={locationContext}
                        onChange={(e) => setLocationContext(e.target.value)}
                        placeholder="City, state — e.g. Manhattan, NY"
                        aria-describedby="modal-location-context-help"
                        className="w-full bg-white border border-gray-100 rounded-xl pl-11 pr-4 py-3.5 text-[14px] font-medium text-[#1A212B] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A5D020]/20 transition-all"
                      />
                    </div>
                    <p id="modal-location-context-help" className="mt-2 text-[11px] font-medium leading-relaxed text-gray-400">
                      Use the city and state for the target branch.
                    </p>
                  </div>
                )}

                {/* Page Type */}
                <div>
                  <label htmlFor="modal-page-type" className="text-[12px] font-black uppercase tracking-widest text-gray-400 mb-2 block">
                    Page Type <span className="text-[#A5D020]">*</span>
                  </label>
                  <div className="relative">
                    <LayoutTemplate size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                    <select
                      id="modal-page-type"
                      required
                      aria-label="Page Type"
                      value={pageType}
                      onChange={(e) => setPageType(e.target.value)}
                      className="w-full bg-white border border-gray-100 rounded-xl pl-11 pr-4 py-3.5 text-[14px] font-medium text-[#1A212B] focus:outline-none focus:ring-2 focus:ring-[#A5D020]/20 transition-all appearance-none cursor-pointer"
                    >
                      {PAGE_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!url.trim() || !pageType.trim() || submitting}
                className="w-full mt-8 flex items-center justify-center gap-2 bg-[#1D2531] text-white font-bold text-[15px] rounded-full px-6 py-4 transition-all hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                {submitting ? "Generating..." : "Run a Trust Audit"}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <p className="mt-6 text-[12px] text-gray-400 text-center font-medium">
                Each audit uses 1 credit from your available balance.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
