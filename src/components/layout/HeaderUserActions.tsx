"use client";

import Link from "next/link";
import { RunAuditButton } from "@/components/common/RunAuditButton";
import { useAppUser } from "@/lib/client-auth";
import { UserDropdown } from "./UserDropdown";

interface HeaderUserActionsProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function HeaderUserActions({ mobile = false, onNavigate }: HeaderUserActionsProps) {
  const { isSignedIn, isLoaded } = useAppUser();
  const actionLabel = isLoaded && isSignedIn ? "Start a Case" : "Start with 5 free credits";

  if (mobile) {
    return (
      <>
        {isLoaded && isSignedIn ? (
          <UserDropdown />
        ) : (
          <Link
            href="/sign-in"
            className="rounded-lg px-4 py-3 text-left text-[15px] font-semibold text-[#26432e]"
            onClick={onNavigate}
          >
            Sign In
          </Link>
        )}
        <RunAuditButton trackingSource="header_mobile" className="w-full rounded-lg bg-[#26432e] py-3 text-[15px] font-semibold text-white">
          {actionLabel}
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
          className="text-[13px] font-semibold text-[#42614a] transition-colors hover:text-[#26432e]"
        >
          Sign In
        </Link>
      )}
      <RunAuditButton trackingSource="header_desktop" className="rounded-lg bg-[#26432e] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#365d40]">
        {actionLabel}
      </RunAuditButton>
    </div>
  );
}
