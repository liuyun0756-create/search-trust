"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, FileText, Zap } from "lucide-react";
import Link from "next/link";
import { useAuditModal } from "@/components/common/AuditModalProvider";
import { useAppAuth, useAppUser } from "@/lib/client-auth";

export function UserDropdown() {
  const { user } = useAppUser();
  const { signOut } = useAppAuth();
  const { credits } = useAuditModal();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const name = user.fullName || "User";
  const image = user.imageUrl;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-[#f2f7f1]"
      >
        {image ? (
          <img
            src={image}
            alt={name}
            className="h-8 w-8 rounded-full border border-[#e3eae2] object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dcefd4] text-[13px] font-bold text-[#26432e]">
            {initial}
          </div>
        )}
        <span className="hidden max-w-[100px] truncate text-[13px] font-semibold text-[#26432e] sm:inline">
          {name}
        </span>
        <ChevronDown
          size={14}
          className={`text-[#8b998d] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-[#e3eae2] bg-white py-2 shadow-[0_16px_36px_rgba(29,42,34,0.1)]">
          <div className="border-b border-[#e3eae2] px-4 py-2">
            <p className="truncate text-[13px] font-semibold text-[#1d2a22]">{name}</p>
            <p className="truncate text-[12px] text-[#8b998d]">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>
          <div className="flex items-center gap-2 border-b border-[#e3eae2] px-4 py-2.5 text-[13px]">
            <Zap size={14} className="text-[#57805b]" />
            <span className="text-[#647466]">Credits:</span>
            <span className="font-semibold text-[#1d2a22]">{credits ?? "..."}</span>
          </div>
          <Link
            href="/reports"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-[#42614a] transition-colors hover:bg-[#f2f7f1]"
          >
            <FileText size={15} />
            My Reports
          </Link>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-[#42614a] transition-colors hover:bg-[#f2f7f1]"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
