"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, FileText, Zap } from "lucide-react";
import Link from "next/link";
import { useAuditModal } from "@/components/common/AuditModalProvider";

export function UserDropdown() {
  const { user } = useUser();
  const { signOut } = useClerk();
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
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-8 h-8 rounded-full object-cover border border-gray-200"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#A5D020] flex items-center justify-center text-white text-[13px] font-bold">
            {initial}
          </div>
        )}
        <span className="hidden sm:inline text-[14px] font-bold text-[#1D2531] max-w-[100px] truncate">
          {name}
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-gray-100 shadow-lg py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-50">
            <p className="text-[13px] font-bold text-[#1D2531] truncate">{name}</p>
            <p className="text-[12px] text-gray-400 truncate">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>
          <div className="px-4 py-2.5 border-b border-gray-50 flex items-center gap-2 text-[13px]">
            <Zap size={14} className="text-[#A5D020]" />
            <span className="text-gray-500">Audit Credits:</span>
            <span className="font-bold text-[#1D2531]">{credits ?? "..."}</span>
          </div>
          <Link
            href="/reports"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-[14px] text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <FileText size={15} />
            My Reports
          </Link>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-[14px] text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
