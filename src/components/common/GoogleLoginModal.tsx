"use client";

import { useEffect, useRef } from "react";
import { X, ShieldCheck, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useClerk } from "@clerk/nextjs";

interface GoogleLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GoogleLoginModal({ isOpen, onClose }: GoogleLoginModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { openSignIn } = useClerk();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
        >
          {/* 1. Overlay - 使用你要求的深色背景 */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#0B0C0E]/80 backdrop-blur-md"
          />

          {/* 2. Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-[#F8F9FA] rounded-[32px] w-full max-w-[480px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/50"
          >
            {/* 装饰性绿光 (Muted Lime Green Accent) */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#A5D020]/10 blur-[60px] rounded-full -mr-16 -mt-16 pointer-events-none" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-100 text-gray-400 hover:text-[#1A212B] hover:shadow-sm transition-all z-20"
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            <div className="p-10 md:p-12 pt-16 relative z-10">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-100 shadow-sm mb-6">
                <div className="w-2 h-2 rounded-full bg-[#A5D020] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Secure Access</span>
              </div>

              {/* Heading - 紧凑行高 (1.1-1.2) */}
              <h2 className="text-[32px] font-bold text-[#1A212B] leading-[1.1] tracking-tighter mb-4">
                Unlock <span className="text-[#A5D020]">Deep</span> <br/>Trust Diagnostics
              </h2>

              {/* Description - 15px Medium Body */}
              <p className="text-[15px] text-[#6B7280] font-medium leading-relaxed mb-10">
                Join SearchTrust to run comprehensive audits, track your history, and reveal hidden trust signals.
              </p>

              {/* Google Button - 升级为高级白色卡片样式 */}
              <button
                className="w-full flex items-center justify-between bg-white hover:bg-gray-50 text-[#1A212B] font-bold text-[15px] rounded-[20px] px-6 py-5 transition-all border border-gray-100 shadow-sm hover:shadow-md group"
                onClick={() => { onClose(); openSignIn(); }}
              >
                <div className="flex items-center gap-4">
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </div>
                <ArrowRight size={18} className="text-gray-300 group-hover:text-[#A5D020] group-hover:translate-x-1 transition-all" />
              </button>

              {/* Security Note */}
              <div className="mt-8 flex items-center justify-center gap-2 text-[#9CA3AF]">
                <ShieldCheck size={14} />
                <span className="text-[12px] font-medium tracking-tight">Enterprise-grade encryption enabled</span>
              </div>

              {/* Footer Links */}
              <div className="mt-12 pt-8 border-t border-gray-100">
                <p className="text-[12px] text-gray-400 text-center leading-relaxed font-medium">
                  By joining, you agree to our{" "}
                  <a href="/policy" className="text-[#3B82F6] hover:text-[#A5D020] transition-colors">Terms</a>
                  {" "}and{" "}
                  <a href="/policy" className="text-[#3B82F6] hover:text-[#A5D020] transition-colors">Privacy Policy</a>.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <path
        d="M19.6 10.2c0-.7-.1-1.4-.2-2H10v3.8h5.4c-.2 1.2-.9 2.1-1.9 2.8v2.3h3c1.8-1.6 2.8-4 2.8-6.9Z"
        fill="#4285F4"
      />
      <path
        d="M10 20c2.7 0 5-.9 6.6-2.4l-3-2.3c-.8.6-1.9.9-3.6.9-2.7 0-5.1-1.8-5.9-4.3H1.1v2.4C2.8 17.6 6.1 20 10 20Z"
        fill="#34A853"
      />
      <path
        d="M4.1 11.9c-.2-.6-.3-1.3-.3-1.9s.1-1.3.3-1.9V5.7H1.1C.4 7.1 0 8.5 0 10s.4 2.9 1.1 4.3l3-2.4Z"
        fill="#FBBC05"
      />
      <path
        d="M10 4.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9C14.9 1 12.7 0 10 0 6.1 0 2.8 2.4 1.1 5.7L4.1 8c.8-2.3 3.1-3.9 5.9-3.9Z"
        fill="#EA4335"
      />
    </svg>
  );
}