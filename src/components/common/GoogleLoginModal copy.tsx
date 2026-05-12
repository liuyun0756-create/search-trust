"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface GoogleLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GoogleLoginModal({ isOpen, onClose }: GoogleLoginModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-[#0B0C0E]/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-[32px] w-full max-w-[480px] p-10 md:p-12 shadow-[0_25px_60px_rgba(0,0,0,0.15)]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        {/* Heading */}
        <h2 className="text-[24px] md:text-[28px] font-bold text-[#1A1F2B] leading-tight mb-4 pr-8">
          Create an account to generate your report
        </h2>

        {/* Description */}
        <p className="text-[15px] text-gray-500 leading-relaxed mb-8">
          Sign in to run trust audits, save your report history, and access
          diagnostic insights across all your submitted pages.
        </p>

        {/* Google Button */}
        <button
          className="w-full flex items-center justify-center gap-3 bg-[#1A1F2B] hover:bg-[#0B0C0E] text-white font-bold text-[15px] rounded-xl py-4 transition-colors"
          onClick={() => {
            // TODO: integrate Google OAuth
          }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Disclaimer */}
        <p className="text-[13px] text-gray-400 text-center mt-6 leading-relaxed">
          By continuing, you agree to our{" "}
          <a
            href="/policy"
            className="text-gray-600 hover:text-[#A5D020] underline underline-offset-2 transition-colors"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="/policy"
            className="text-gray-600 hover:text-[#A5D020] underline underline-offset-2 transition-colors"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M18.171 8.368H17.5V8.333h-7.5v3.334h4.63A4.168 4.168 0 0 1 6.9 13.72l-2.44 1.88A7.5 7.5 0 0 0 17.5 10c0-.558-.076-1.1-.194-1.632h.865Z"
        fill="#FFC107"
      />
      <path
        d="M5.17 11.975A4.5 4.5 0 0 1 5 10c0-.69.12-1.352.34-1.968L2.9 6.153a7.5 7.5 0 0 0 0 7.694l2.27-1.872Z"
        fill="#FF5722"
      />
      <path
        d="M10 2.5c1.69 0 3.218.59 4.418 1.56l2.47-1.912A7.47 7.47 0 0 0 10 0 7.5 7.5 0 0 0 2.9 3.28l2.44 1.88A4.5 4.5 0 0 1 10 2.5Z"
        fill="#FF3D00"
      />
      <path
        d="M17.5 10a7.5 7.5 0 0 1-12.83 5.31l2.44-1.88A4.168 4.168 0 0 0 14.63 11.5h-4.63V8.167h7.5c.118.532.194 1.074.194 1.632 0 .558-.076 1.1-.194 1.632v.569Z"
        fill="#4CAF50"
      />
      <path
        d="M10 17.5a7.47 7.47 0 0 0 6.888-4.19l-2.47-1.91A4.5 4.5 0 0 1 6.9 13.72l-2.44 1.88A7.5 7.5 0 0 0 10 17.5Z"
        fill="#1976D2"
      />
    </svg>
  );
}
