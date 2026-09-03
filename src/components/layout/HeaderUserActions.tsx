"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { RunAuditButton } from "@/components/common/RunAuditButton";
import { UserDropdown } from "./UserDropdown";

interface HeaderUserActionsProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function HeaderUserActions({ mobile = false, onNavigate }: HeaderUserActionsProps) {
  const { isSignedIn, isLoaded } = useUser();

  if (mobile) {
    return (
      <>
        {isLoaded && isSignedIn ? (
          <UserDropdown />
        ) : (
          <Link
            href="/sign-in"
            className="text-left text-[16px] font-bold text-[#1D2531]"
            onClick={onNavigate}
          >
            Sign In
          </Link>
        )}
        <RunAuditButton className="w-full rounded-full bg-[#1D2531] py-4 text-[16px] font-bold text-white">
          Start free preflight
        </RunAuditButton>
      </>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-6">
      {isLoaded && isSignedIn ? (
        <UserDropdown />
      ) : (
        <Link
          href="/sign-in"
          className="text-[14px] font-bold text-[#1D2531] hover:opacity-70 transition-opacity"
        >
          Sign In
        </Link>
      )}
      <RunAuditButton className="rounded-full bg-[#1D2531] px-6 py-2.5 text-[14px] font-bold text-white transition-all hover:bg-black">
        Start free preflight
      </RunAuditButton>
    </div>
  );
}
