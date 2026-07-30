"use client";

import { useRef, useState } from "react";
import { X, CreditCard, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { track } from "@/lib/analytics-client";
import { getAuditEventProperties } from "@/lib/analytics-properties";

const PENDING_AUDIT_STORAGE_KEY = "searchtrust_pending_audit";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  formData?: { url: string; gbpUrl: string; pageType: string } | null;
}

export function PaymentModal({ isOpen, onClose, formData }: PaymentModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    track(
      "checkout clicked",
      getAuditEventProperties({
        url: formData?.url,
        pageType: formData?.pageType,
        gbpUrl: formData?.gbpUrl,
      })
    );
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData }),
      });

      if (!res.ok) throw new Error("Checkout failed");

      const { checkout_url } = await res.json();

      if (checkout_url) {
        sessionStorage.removeItem(PENDING_AUDIT_STORAGE_KEY);
        window.location.href = checkout_url;
      }
    } catch (err) {
      console.error("Payment error:", err);
      alert("Payment failed. Please try again.");
      setLoading(false);
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
              aria-label="Close checkout"
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-100 text-gray-400 hover:text-[#1A212B] hover:shadow-sm transition-all z-20"
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            <div className="p-10 md:p-12 pt-16 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-100 shadow-sm mb-6">
                <div className="w-2 h-2 rounded-full bg-[#A5D020] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Checkout</span>
              </div>

              <h2 className="text-[28px] font-bold text-[#1A212B] leading-[1.15] tracking-tighter mb-2">
                Buy 1 <span className="text-[#A5D020]">Trust</span> Audit
              </h2>
              <p className="text-[14px] text-[#6B7280] font-medium leading-relaxed mb-8">
                One audit credit for a comprehensive trust diagnosis of your page.
              </p>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-gray-500">Trust Audit Credit x1</span>
                  <span className="text-[18px] font-bold text-[#1A212B]">$19</span>
                </div>
              </div>

              <button
                onClick={handlePay}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#1D2531] text-white font-bold text-[15px] rounded-full px-6 py-4 transition-all hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CreditCard size={18} />
                {loading ? "Redirecting..." : "Pay $19"}
              </button>

              <div className="mt-6 flex items-center justify-center gap-2 text-[#9CA3AF]">
                <ShieldCheck size={14} />
                <span className="text-[12px] font-medium">Secure payment via Dodo Payments</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
