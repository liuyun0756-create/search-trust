"use client";

import { track } from "@/lib/analytics-client";
import { useRouter } from "next/navigation";

interface RunAuditButtonProps {
  className?: string;
  children: React.ReactNode;
  trackingSource?: string;
}

export function RunAuditButton({
  className,
  children,
  trackingSource = "unknown",
}: RunAuditButtonProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        if (!window.dispatchEvent(new Event("searchtrust:before-navigation", { cancelable: true }))) return;
        track("preflight cta clicked", { source: trackingSource });
        router.push("/cases/new");
      }}
      className={className}
    >
      {children}
    </button>
  );
}
