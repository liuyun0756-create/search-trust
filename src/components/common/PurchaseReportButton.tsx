"use client";

import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics-client";

interface PurchaseReportButtonProps {
  className?: string;
  children: React.ReactNode;
  trackingSource?: string;
}

export function PurchaseReportButton({
  className,
  children,
  trackingSource = "pricing",
}: PurchaseReportButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        track("purchase cta clicked", { source: trackingSource });
        router.push("/cases/new");
      }}
      className={className}
    >
      {children}
    </button>
  );
}
